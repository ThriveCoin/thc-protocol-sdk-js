import { ethers } from 'ethers'
import { EventEmitter } from 'events'

import ThriveStakingNativeABI from './abis/ThriveStakingNative.json'
import ThriveStakingIERC20ABI from './abis/ThriveStakingIERC20.json'
import ThriveWalletMissingError from './errors/ThriveWalletMissingError'
import ThriveProviderMissingError from './errors/ThriveProviderMissingError'
import ThriveContractNotInitializedError from './errors/ThriveContractNotInitializedError'

export enum ThriveStakingType {
  IERC20 = 'IERC20',
  NATIVE = 'NATIVE'
}

export enum ThriveStakingEventEnum {
  Staked = 'Staked',
  Withdrawn = 'Withdrawn',
  YieldClaimed = 'YieldClaimed'
}

export type ThriveStakingEventKey = keyof typeof ThriveStakingEventEnum

export interface ThriveStakingEvent {
  fragment: ethers.EventFragment,
  log: ethers.EventLog,
  type: ThriveStakingEventKey
  user: string
  amount: string
  yield: string
  timestamp: number
  block?: string
  tx?: string
}

export type ThriveStakingEventListener = (event: ThriveStakingEvent) => void

export interface ThriveStakingOptions {
  wallet?: ethers.Wallet
  provider?: ethers.Provider
  nativeAddress: string
  ierc20Address: string
  token: string
  yieldRate: string
  minStakingAmount: string
  accessControlEnumerable: string
  role: string
}

export class ThriveStaking {
  protected wallet?: ethers.Wallet
  protected provider?: ethers.Provider
  protected nativeAddress: string
  protected ierc20Address: string
  protected token: string
  protected contract?: ethers.Contract
  protected stakingType: ThriveStakingType
  protected eventInterface: ethers.Interface
  protected eventListener: EventEmitter
  protected eventListenerCount = new Map<ThriveStakingEventKey, number>([
    [ThriveStakingEventEnum.Withdrawn, 0],
    [ThriveStakingEventEnum.YieldClaimed, 0],
    [ThriveStakingEventEnum.Staked, 0]
  ])

  constructor (params: ThriveStakingOptions, stakingType: ThriveStakingType = ThriveStakingType.IERC20) {
    this.wallet = params.wallet
    this.provider = params.provider
    this.nativeAddress = params.nativeAddress
    this.ierc20Address = params.ierc20Address
    this.token = params.token
    this.stakingType = stakingType

    this.initContract()

    const eventAbis = [
      ...ThriveStakingNativeABI.filter((item) => item.type === 'event'),
      ...ThriveStakingIERC20ABI.filter((item) => item.type === 'event')
    ]
    this.eventInterface = new ethers.Interface(eventAbis)

    this.eventListener =
          new EventEmitter<Record<ThriveStakingEventKey, [event: ThriveStakingEvent]>>({ captureRejections: true })
  }

  private initContract () {
    if (!this.provider && !this.wallet) {
      throw new ThriveProviderMissingError()
    }
    const signerOrProvider = this.wallet || this.provider!
    if (this.stakingType === ThriveStakingType.NATIVE) {
      this.contract = new ethers.Contract(this.nativeAddress, ThriveStakingNativeABI, signerOrProvider)
    } else {
      this.contract = new ethers.Contract(this.ierc20Address, ThriveStakingIERC20ABI, signerOrProvider)
    }
  }

  public setWallet (wallet: ethers.Wallet) {
    this.wallet = wallet
    if (this.contract) {
      this.contract = this.contract.connect(wallet) as ethers.Contract
    }
  }

  public getWalletAddress (): string {
    if (!this.wallet) {
      throw new ThriveWalletMissingError()
    }
    return this.wallet.address
  }

  public switchStakingType (stakingType: ThriveStakingType) {
    this.stakingType = stakingType
    this.initContract()
  }

  protected eventListenerFunc (...args: ThriveStakingEvent[]) {
    const ev = args[args.length - 1]
    const type = ev.fragment.name as ThriveStakingEventKey

    if (type === 'Staked') {
      this.eventListener.emit(type, {
        type,
        user: args[0].toString(),
        amount: args[1].toString(),
        yield: '0',
        timestamp: Date.now(),
        block: ev.log.blockNumber.toString(),
        tx: ev.log.transactionHash
      })
    } else if (type === 'Withdrawn') {
      this.eventListener.emit(type, {
        type,
        user: args[0].toString(),
        amount: args[1].toString(),
        yield: args[2].toString(),
        timestamp: Date.now(),
        block: ev.log.blockNumber.toString(),
        tx: ev.log.transactionHash
      })
    } else if (type === 'YieldClaimed') {
      this.eventListener.emit(type, {
        type,
        user: args[0].toString(),
        amount: '0',
        yield: args[1].toString(),
        timestamp: Date.now(),
        block: ev.log.blockNumber.toString(),
        tx: ev.log.transactionHash
      })
    }
  }

  public onContractEvent (type: ThriveStakingEventKey, listener: ThriveStakingEventListener) {
    this.eventListener.addListener(type, listener)
    const count = this.eventListenerCount.get(type) || 0
    if (count === 0) {
      this.contract?.on(type, this.eventListenerFunc.bind(this))
    }
    this.eventListenerCount.set(type, count + 1)
  }

  public offEvent (eventType: ThriveStakingEventKey, listener?: ThriveStakingEventListener) {
    if (listener) {
      this.eventListener.removeListener(eventType, listener)
      const count = (this.eventListenerCount.get(eventType) || 1) - 1
      if (count === 0) {
        this.contract?.off(eventType)
      }
      this.eventListenerCount.set(eventType, count)
    } else {
      this.eventListener.removeAllListeners(eventType)
      this.contract?.off(eventType)
      this.eventListenerCount.set(eventType, 0)
    }
  }

  public async stake (amount: string): Promise<string> {
    if (!this.wallet) throw new ThriveWalletMissingError()
    if (!this.contract) throw new ThriveContractNotInitializedError()

    let tx
    if (this.stakingType === ThriveStakingType.NATIVE) {
      tx = await this.contract.stake(amount, { value: amount })
    } else {
      tx = await this.contract.stake(amount)
    }
    await tx.wait()

    return tx.hash
  }

  public async withdraw (): Promise<string> {
    if (!this.wallet) throw new ThriveWalletMissingError()
    if (!this.contract) throw new ThriveContractNotInitializedError()

    const tx = await this.contract.withdraw()

    await tx.wait()

    return tx.hash
  }

  public async claimYield (): Promise<string> {
    if (!this.wallet) throw new ThriveWalletMissingError()
    if (!this.contract) throw new ThriveContractNotInitializedError()

    const tx = await this.contract.claimYield()

    await tx.wait()

    return tx.hash
  }

  public async calculateYield (address?: string): Promise<string> {
    if (!this.contract) throw new ThriveContractNotInitializedError()
    const userAddress = address || this.getWalletAddress()
    const yieldAmount = await this.contract.calculateYield(userAddress)

    return yieldAmount.toString()
  }

  public async setYieldRate (newYieldRate: string): Promise<string> {
    if (!this.wallet) throw new ThriveWalletMissingError()
    if (!this.contract) throw new ThriveContractNotInitializedError()

    const tx = await this.contract.setYieldRate(newYieldRate)
    await tx.wait()

    return tx.hash
  }

  public async setMinStakingAmount (newMin: string): Promise<string> {
    if (!this.wallet) throw new ThriveWalletMissingError()
    if (!this.contract) throw new ThriveContractNotInitializedError()

    const tx = await this.contract.setMinStakingAmount(newMin)

    await tx.wait()

    return tx.hash
  }
}
