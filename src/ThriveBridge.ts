import { ethers } from 'ethers'
import { EventEmitter } from 'events'

import ThriveIERC20WrapperABI from './abis/ThriveIERC20Wrapper.json'
import ThriveBridgeSourceIERC20ABI from './abis/ThriveBridgeSourceIERC20.json'
import ThriveBridgeSourceNativeABI from './abis/ThriveBridgeSourceNative.json'
import ThriveBridgeDestinationABI from './abis/ThriveBridgeDestination.json'
import ThriveWalletMissingError from './errors/ThriveWalletMissingError'

type BlockRange = string | number | bigint

export enum ThriveBridgeSourceType {
  IERC20 = 'IERC20',
  NATIVE = 'NATIVE'
}

export interface ThriveBridgeEvent {
  sender: string,
  receiver: string,
  amount: string,
  timestamp: number,
  nonce: string,
  signature: string,
  block: string,
  tx: string
}

export type ThriveBridgeEventKey = 'TokenLocked' | 'TokenUnlocked' | 'TokenMinted' | 'TokenBurned'
export type ThriveBridgeSourceEventKey = 'TokenLocked' | 'TokenUnlocked'
export type ThriveBridgeDestinationEventKey = 'TokenMinted' | 'TokenBurned'
export type ThriveBridgeEventListener = (event: ThriveBridgeEvent) => void

export interface ThriveBridgeOptions {
  wallet?: ethers.Wallet,
  provider?: ethers.Provider,
  sourceAddress: string
  destinationAddress: string
  tokenAddress?: string,
}

export abstract class ThriveBridge {
  protected wallet?: ethers.Wallet
  protected provider?: ethers.Provider
  protected sourceAddress: string
  protected destinationAddress: string
  protected tokenAddress?: string
  protected tokenContract?: ethers.Contract
  protected tokenDecimals?: number
  protected bridgeContract!: ethers.Contract
  protected eventInterface: ethers.Interface
  protected eventListener: EventEmitter<Record<ThriveBridgeEventKey, [event: ThriveBridgeEvent]>>

  constructor (params: ThriveBridgeOptions) {
    this.wallet = params.wallet
    this.provider = params.provider
    this.sourceAddress = params.sourceAddress
    this.destinationAddress = params.destinationAddress
    this.tokenAddress = params.tokenAddress

    if (this.tokenAddress) {
      this.tokenContract = new ethers.Contract(this.tokenAddress, ThriveIERC20WrapperABI, this.wallet ?? this.provider)
    }

    this.eventInterface = new ethers.Interface([
      ...ThriveBridgeSourceIERC20ABI.filter(x => x.type === 'event'),
      ...ThriveBridgeDestinationABI.filter(x => x.type === 'event')
    ])

    this.eventListener =
      new EventEmitter<Record<ThriveBridgeEventKey, [event: ThriveBridgeEvent]>>({ captureRejections: true })
  }

  protected async prepareSignature (contract: string, sender: string, receiver: string, amount: string, nonce: string) {
    if (!this.wallet) {
      throw new ThriveWalletMissingError()
    }

    const hash = ethers.keccak256(
      ethers.solidityPacked(
        ['address', 'address', 'address', 'uint256', 'uint256'],
        [contract, sender, receiver, nonce, amount]
      )
    )
    const signature = await this.wallet.signMessage(ethers.getBytes(hash))

    return signature
  }

  protected async getTokenDecimals () {
    this.tokenDecimals ??= +((await this.tokenContract!.decimals()) as bigint).toString()
    return this.tokenDecimals
  }

  public setWallet (wallet: ethers.Wallet) {
    this.wallet = wallet
    this.bridgeContract = this.bridgeContract.connect(this.wallet) as ethers.Contract
  }

  public getWallet () {
    if (!this.wallet) {
      throw new ThriveWalletMissingError()
    }
    return this.wallet.address
  }

  async getBridgeEvents (type: ThriveBridgeEventKey, from: BlockRange, to: BlockRange): Promise<ThriveBridgeEvent[]> {
    const eventFilter = this.bridgeContract.filters[type]()
    from = typeof from !== 'number' && from !== 'latest' ? +(from.toString()) : from
    to = typeof to !== 'number' && to !== 'latest' ? +(to.toString()) : to

    const raw = await this.bridgeContract.queryFilter(eventFilter, from, to)

    const events: ThriveBridgeEvent[] = []

    for (const ev of raw) {
      const parsed = this.eventInterface.parseLog(ev)
      if (!parsed) {
        continue
      }
      events.push({
        sender: parsed!.args[0],
        receiver: parsed!.args[1],
        amount: parsed!.args[2].toString(),
        timestamp: Number(parsed!.args[3]) * 1000,
        nonce: parsed!.args[4].toString(),
        signature: parsed!.args[5].toString(),
        block: ev.blockNumber.toString(),
        tx: ev.transactionHash
      })
    }

    return events
  }

  public onBridgeEvents (type: ThriveBridgeEventKey, listener: ThriveBridgeEventListener) {
    this.eventListener.addListener(type, listener)
  }

  public offBridgeEvents (type: ThriveBridgeEventKey, listener?: ThriveBridgeEventListener) {
    if (listener) {
      this.eventListener.removeListener(type, listener)
    } else {
      this.eventListener.removeAllListeners(type)
    }
  }
}

export class ThriveBridgeSource extends ThriveBridge {
  protected contractType: ThriveBridgeSourceType

  constructor (params: ThriveBridgeOptions & { sourceContractType: ThriveBridgeSourceType }) {
    super(params)
    this.contractType = params.sourceContractType
    if (this.contractType === ThriveBridgeSourceType.IERC20 && !this.tokenAddress) {
      throw new Error('ThriveProtocol: token address required')
    }

    this.bridgeContract = new ethers.Contract(
      this.sourceAddress,
      this.contractType === ThriveBridgeSourceType.NATIVE ? ThriveBridgeSourceNativeABI : ThriveBridgeSourceIERC20ABI,
      this.wallet ?? this.provider
    )
  }

  protected async getTokenDecimals () {
    if (this.contractType === ThriveBridgeSourceType.NATIVE) {
      return 18
    }
    return super.getTokenDecimals()
  }

  async lockTokens (params: { receiver: string, amountUnit?: string, amount?: string }): Promise<string> {
    if (!this.wallet) {
      throw new ThriveWalletMissingError()
    }

    const { receiver } = params
    const amountUnit = params.amountUnit ?? ethers.parseUnits(params.amount!, await this.getTokenDecimals()).toString()
    const sender = this.wallet.address
    const nonce = ((await this.bridgeContract.lockNonces(this.wallet.address)) as bigint).toString()
    const signature = await this.prepareSignature(this.sourceAddress, sender, receiver, amountUnit, nonce)

    if (this.contractType === ThriveBridgeSourceType.IERC20) {
      const ercTx = await this.tokenContract!.approve(this.sourceAddress, amountUnit)
      await ercTx.wait()
    }

    const tx = await this.bridgeContract.lockTokens(
      receiver,
      amountUnit,
      signature,
      { value: this.contractType === ThriveBridgeSourceType.NATIVE ? amountUnit : '0' }
    )
    await tx.wait()
    return tx.hash
  }

  async unlockTokens (
    params: { sender: string, receiver: string, amountUnit?: string, amount?: string, nonce: string, signature: string }
  ): Promise<string> {
    if (!this.wallet) {
      throw new ThriveWalletMissingError()
    }

    const { sender, receiver, nonce, signature } = params
    const amountUnit = params.amountUnit ?? ethers.parseUnits(params.amount!, await this.getTokenDecimals()).toString()

    const tx = await this.bridgeContract.unlockTokens(sender, receiver, amountUnit, nonce, signature)
    await tx.wait()
    return tx.hash
  }

  async getBridgeEvents (
    type: 'TokenLocked' | 'TokenUnlocked', from: BlockRange, to: BlockRange
  ): Promise<ThriveBridgeEvent[]> {
    return super.getBridgeEvents(type, from, to)
  }

  public onBridgeEvents (type: ThriveBridgeSourceEventKey, listener: ThriveBridgeEventListener) {
    super.onBridgeEvents(type, listener)
  }

  public offBridgeEvents (type: ThriveBridgeSourceEventKey, listener?: ThriveBridgeEventListener) {
    super.offBridgeEvents(type, listener)
  }
}

export class ThriveBridgeDestination extends ThriveBridge {
  constructor (params: ThriveBridgeOptions & { tokenAddress: string }) {
    super(params)

    if (!this.tokenAddress) {
      throw new Error('ThriveProtocol: token address required')
    }

    this.bridgeContract = new ethers.Contract(
      this.destinationAddress,
      ThriveBridgeDestinationABI,
      this.wallet ?? this.provider
    )
  }

  async mintTokens (
    params: { sender: string, receiver: string, amountUnit?: string, amount?: string, nonce: string, signature: string }
  ): Promise<string> {
    if (!this.wallet) {
      throw new ThriveWalletMissingError()
    }

    const { sender, receiver, nonce, signature } = params
    const amountUnit = params.amountUnit ?? ethers.parseUnits(params.amount!, await this.getTokenDecimals()).toString()

    const tx = await this.bridgeContract.mintTokens(sender, receiver, amountUnit, nonce, signature)
    await tx.wait()
    return tx.hash
  }

  async burnTokens (params: { receiver: string, amountUnit?: string, amount?: string }): Promise<string> {
    if (!this.wallet) {
      throw new ThriveWalletMissingError()
    }

    const { receiver } = params
    const sender = this.wallet.address
    const amountUnit = params.amountUnit ?? ethers.parseUnits(params.amount!, await this.getTokenDecimals()).toString()
    const nonce = ((await this.bridgeContract.burnNonces(this.wallet.address)) as bigint).toString()
    const signature = await this.prepareSignature(this.destinationAddress, sender, receiver, amountUnit, nonce)

    const ercTx = await this.tokenContract!.approve(this.destinationAddress, amountUnit)
    await ercTx.wait()

    const tx = await this.bridgeContract.burnTokens(receiver, amountUnit, signature)
    await tx.wait()
    return tx.hash
  }

  async getBridgeEvents (
    type: 'TokenMinted' | 'TokenBurned', from: BlockRange, to: BlockRange
  ): Promise<ThriveBridgeEvent[]> {
    return super.getBridgeEvents(type, from, to)
  }

  public onBridgeEvents (type: ThriveBridgeDestinationEventKey, listener: ThriveBridgeEventListener) {
    super.onBridgeEvents(type, listener)
  }

  public offBridgeEvents (type: ThriveBridgeDestinationEventKey, listener?: ThriveBridgeEventListener) {
    super.offBridgeEvents(type, listener)
  }
}
