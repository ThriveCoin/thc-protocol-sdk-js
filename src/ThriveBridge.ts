import { BigNumberish, ethers, keccak256 } from 'ethers'
import { EventEmitter } from 'events'

import ThriveIERC20WrapperABI from './abis/ThriveIERC20Wrapper.json'
import ThriveBridgeSourceIERC20ABI from './abis/ThriveBridgeSourceIERC20.json'
import ThriveBridgeSourceNativeABI from './abis/ThriveBridgeSourceNative.json'
import ThriveBridgeDestinationABI from './abis/ThriveBridgeDestination.json'
import ThriveBridgeDestinationWithComplianceABI from './abis/ThriveBridgeDestinationWithCompliance.json'
import ThriveWalletMissingError from './errors/ThriveWalletMissingError'
import ThriveProviderMissingError from './errors/ThriveProviderMissingError'
import ThriveProviderTxNotFoundError from './errors/ThriveProviderTxNotFoundError'
import ThriveFeatureNotSupportedError from './errors/ThriveFeatureNotSupportedError'

type BlockRange = string | number | bigint

export enum ThriveBridgeSourceType {
  IERC20 = 'IERC20',
  NATIVE = 'NATIVE'
}
export enum ThriveBridgeDestinationType {
  BASE = 'BASE',
  COMPLIANCE = 'COMPLIANCE'
}

export enum ThriveBridgeEventEnum {
  'TokenLocked' = 'TokenLocked',
  'TokenUnlocked' = 'TokenUnlocked',
  'TokenMinted' = 'TokenMinted',
  'TokenBurned' = 'TokenBurned',
}

export type ThriveBridgeEventKey = 'TokenLocked' | 'TokenUnlocked' | 'TokenMinted' | 'TokenBurned'
export type ThriveBridgeSourceEventKey = 'TokenLocked' | 'TokenUnlocked'
export type ThriveBridgeDestinationEventKey = 'TokenMinted' | 'TokenBurned'

export interface ThriveBridgeEvent {
  type: ThriveBridgeEventKey,
  sender: string,
  receiver: string,
  amount: string,
  timestamp: number,
  nonce: string,
  signature: string,
  block: string,
  tx: string
}

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
  protected eventListenerCount = new Map<ThriveBridgeEventKey, number>([
    [ThriveBridgeEventEnum.TokenLocked, 0],
    [ThriveBridgeEventEnum.TokenUnlocked, 0],
    [ThriveBridgeEventEnum.TokenMinted, 0],
    [ThriveBridgeEventEnum.TokenBurned, 0]
  ])

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

  async getBridgeEventsFromHash (hash: string): Promise<ThriveBridgeEvent[]> {
    if (!this.provider) {
      throw new ThriveProviderMissingError()
    }
    const receipt = await this.provider.getTransactionReceipt(hash)
    if (!receipt) {
      throw new ThriveProviderTxNotFoundError()
    }

    const address = await this.bridgeContract.getAddress()
    const events: ThriveBridgeEvent[] = []

    receipt.logs.forEach((log) => {
      if (log.address.toLowerCase() !== address.toLowerCase()) {
        return
      }
      try {
        const parsed = this.eventInterface.parseLog(log)
        if (!parsed) {
          return
        }
        const type = parsed.fragment.name
        if (!Object.keys(ThriveBridgeEventEnum).includes(type)) {
          return
        }

        events.push({
          type: type as ThriveBridgeEventKey,
          sender: parsed!.args[0].toString(),
          receiver: parsed!.args[1].toString(),
          amount: parsed!.args[2].toString(),
          timestamp: Number(parsed!.args[3]) * 1000,
          nonce: parsed!.args[4].toString(),
          signature: parsed!.args[5].toString(),
          block: receipt.blockNumber.toString(),
          tx: hash
        })
      } catch { }
    })

    return events
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
        type,
        sender: parsed!.args[0].toString(),
        receiver: parsed!.args[1].toString(),
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

  protected eventListenerFunc (sender: string, receiver: string, amount: bigint, timestamp: bigint, nonce: bigint, signature: string, ev: ethers.ContractEventPayload) {
    const type = ev.fragment.name as ThriveBridgeEventKey
    this.eventListener.emit(type, {
      type,
      sender: sender.toString(),
      receiver: receiver.toString(),
      amount: amount.toString(),
      timestamp: Number(timestamp) * 1000,
      nonce: nonce.toString(),
      signature: signature.toString(),
      block: ev.log.blockNumber.toString(),
      tx: ev.log.transactionHash
    })
  }

  public onBridgeEvent (type: ThriveBridgeEventKey, listener: ThriveBridgeEventListener) {
    this.eventListener.addListener(type, listener)
    const count = this.eventListenerCount.get(type)!
    if (count === 0) {
      // set listener on contract
      this.bridgeContract.on(type, this.eventListenerFunc.bind(this))
    }
    this.eventListenerCount.set(type, count + 1)
  }

  public offBridgeEvent (type: ThriveBridgeEventKey, listener?: ThriveBridgeEventListener) {
    if (listener) {
      this.eventListener.removeListener(type, listener)
      const count = this.eventListenerCount.get(type)! - 1
      if (count === 0) {
        // set off listener on contract
        this.bridgeContract.off(type)
      }
      if (count >= 0) {
        this.eventListenerCount.set(type, count)
      }
    } else {
      this.eventListener.removeAllListeners(type)
      this.bridgeContract.off(type)
      this.eventListenerCount.set(type, 0)
    }
  }

  public abstract isNonceProcessed (sender: string, nonce: BigNumberish): Promise<boolean>
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
    type: ThriveBridgeSourceEventKey, from: BlockRange, to: BlockRange
  ): Promise<ThriveBridgeEvent[]> {
    return super.getBridgeEvents(type, from, to)
  }

  public onBridgeEvent (type: ThriveBridgeSourceEventKey, listener: ThriveBridgeEventListener) {
    super.onBridgeEvent(type, listener)
  }

  public offBridgeEvent (type: ThriveBridgeSourceEventKey, listener?: ThriveBridgeEventListener) {
    super.offBridgeEvent(type, listener)
  }

  public async isNonceProcessed (sender: string, nonce: BigNumberish): Promise<boolean> {
    return await this.bridgeContract.unlockNonces(sender, nonce)
  }
}

export class ThriveBridgeDestination extends ThriveBridge {
  protected contractType: ThriveBridgeDestinationType

  constructor (params: ThriveBridgeOptions & { tokenAddress: string, destinationContractType: ThriveBridgeDestinationType }) {
    super(params)
    this.contractType = params.destinationContractType

    if (!this.tokenAddress) {
      throw new Error('ThriveProtocol: token address required')
    }

    this.bridgeContract = new ethers.Contract(
      this.destinationAddress,
      this.contractType === ThriveBridgeDestinationType.COMPLIANCE
        ? ThriveBridgeDestinationWithComplianceABI
        : ThriveBridgeDestinationABI,
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
    type: ThriveBridgeDestinationEventKey, from: BlockRange, to: BlockRange
  ): Promise<ThriveBridgeEvent[]> {
    return super.getBridgeEvents(type, from, to)
  }

  public onBridgeEvent (type: ThriveBridgeDestinationEventKey, listener: ThriveBridgeEventListener) {
    super.onBridgeEvent(type, listener)
  }

  public offBridgeEvent (type: ThriveBridgeDestinationEventKey, listener?: ThriveBridgeEventListener) {
    super.offBridgeEvent(type, listener)
  }

  public async isNonceProcessed (sender: string, nonce: BigNumberish): Promise<boolean> {
    return await this.bridgeContract.mintNonces(sender, nonce)
  }

  async setComplianceRule (checkType: string, limit: string): Promise<string> {
    if (!this.wallet) {
      throw new ThriveWalletMissingError()
    }
    if (this.contractType !== ThriveBridgeDestinationType.COMPLIANCE) {
      throw new ThriveFeatureNotSupportedError()
    }

    const tx = await this.bridgeContract.setComplianceRule(keccak256(checkType), limit)
    await tx.wait()
    return tx.hash
  }

  async removeComplianceRule (checkType: string): Promise<string> {
    if (!this.wallet) {
      throw new ThriveWalletMissingError()
    }
    if (this.contractType !== ThriveBridgeDestinationType.COMPLIANCE) {
      throw new ThriveFeatureNotSupportedError()
    }

    const tx = await this.bridgeContract.removeComplianceRule(keccak256(checkType))
    await tx.wait()
    return tx.hash
  }
}
