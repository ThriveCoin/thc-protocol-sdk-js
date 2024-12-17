import { ethers } from 'ethers'
import { EventEmitter } from 'events'

import ThriveWorkerUnitABI from './abis/ThriveWorkerUnit.json'
import ThriveWorkerUnitFactoryABI from './abis/ThriveWorkerUnitFactory.json'
import ThriveWalletMissingError from './errors/ThriveWalletMissingError'
import ThriveProviderMissingError from './errors/ThriveProviderMissingError'
import ThriveProviderTxNotFoundError from './errors/ThriveProviderTxNotFoundError'

export enum ThriveWorkerUnitTokenType {
  IERC20 = 'IERC20',
  NATIVE = 'NATIVE'
}

export enum ThriveWorkerUnitEventEnum {
  'Withdrawn' = 'Withdrawn',
  'Initialized' = 'Initialized',
  'ConfirmationAdded' = 'ConfirmationAdded'
}

export type ThriveWorkerUnitEventKey = 'Withdrawn' | 'Initialized' | 'ConfirmationAdded'

export interface ThriveWorkerUnitEvent {
  type: ThriveWorkerUnitEventKey,
  contributor: string,
  validationMetadata: string,
  rewardAmount: string,
  validator: string,
  token: string,
  amount: string,
  timestamp: number,
  block?: string,
  tx?: string
}

export type ThriveWorkerUnitEventListener = (event: ThriveWorkerUnitEvent) => void

export interface ThriveWorkerUnitOptions {
  wallet?: ethers.Wallet,
  provider?: ethers.Provider,
  contractAddress: string,
  factoryAddress?: string
}

export class ThriveWorkerUnit {
  protected wallet?: ethers.Wallet
  protected provider?: ethers.Provider
  protected contractAddress: string
  protected factoryAddress?: string
  protected contract: ethers.Contract
  protected factoryContract?: ethers.Contract
  protected eventInterface: ethers.Interface
  protected eventListener: EventEmitter<Record<ThriveWorkerUnitEventKey, [event: ThriveWorkerUnitEvent]>>
  protected eventListenerCount = new Map<ThriveWorkerUnitEventKey, number>([
    [ThriveWorkerUnitEventEnum.Initialized, 0],
    [ThriveWorkerUnitEventEnum.ConfirmationAdded, 0],
    [ThriveWorkerUnitEventEnum.Withdrawn, 0]
  ])

  constructor (params: ThriveWorkerUnitOptions) {
    this.wallet = params.wallet
    this.provider = params.provider
    this.contractAddress = params.contractAddress
    this.factoryAddress = params.factoryAddress

    this.contract = new ethers.Contract(this.contractAddress, ThriveWorkerUnitABI, this.wallet ?? this.provider)

    if (this.factoryAddress) {
      this.factoryContract = new ethers.Contract(this.factoryAddress, ThriveWorkerUnitFactoryABI, this.wallet ?? this.provider)
    }

    this.eventInterface = new ethers.Interface(ThriveWorkerUnitABI.filter(x => x.type === 'event'))
    this.eventListener = new EventEmitter<Record<ThriveWorkerUnitEventKey, [event: ThriveWorkerUnitEvent]>>({ captureRejections: true })
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

  public setWallet (wallet: ethers.Wallet) {
    this.wallet = wallet
    this.contract = this.contract.connect(this.wallet) as ethers.Contract
    if (this.factoryContract) {
      this.factoryContract = this.factoryContract.connect(this.wallet) as ethers.Contract
    }
  }

  public getWallet () {
    if (!this.wallet) {
      throw new ThriveWalletMissingError()
    }
    return this.wallet.address
  }

  public async createNewWorkerUnit (...args: ThriveWorkerUnitOptions[]): Promise<string> {
    if (!this.wallet) {
      throw new ThriveWalletMissingError()
    }
    if (!this.factoryContract) {
      throw new Error('Factory contract is not initialized')
    }

    const tx = await this.factoryContract.createThriveWorkerUnit(...args)
    const receipt = await tx.wait()

    const event = receipt.events?.find((e: { event: string }) => e.event === 'NewWorkerUnitCreated')
    if (event) {
      const newContractAddress = event.args?.[0]
      return newContractAddress
    }

    throw new Error('Failed to retrieve new Worker Unit address')
  }

  public async getContractEventsFromHash (hash: string): Promise<ThriveWorkerUnitEvent[]> {
    if (!this.provider) {
      throw new ThriveProviderMissingError()
    }
    const receipt = await this.provider.getTransactionReceipt(hash)
    if (!receipt) {
      throw new ThriveProviderTxNotFoundError()
    }

    const address = await this.contract.getAddress()
    const events: ThriveWorkerUnitEvent[] = []

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
        if (!Object.keys(ThriveWorkerUnitEventEnum).includes(type)) {
          return
        }

        events.push({
          type: type as ThriveWorkerUnitEventKey,
          contributor: parsed.args[0]?.toString(),
          validationMetadata: parsed.args[1]?.toString(),
          rewardAmount: parsed.args[2]?.toString(),
          validator: parsed.args[3]?.toString(),
          token: parsed.args[4]?.toString(),
          amount: parsed.args[5]?.toString(),
          timestamp: Number(parsed.args[6]) * 1000,
          block: receipt.blockNumber.toString(),
          tx: hash
        })
      } catch { }
    })

    return events
  }

  protected eventListenerFunc (contributor: string, validationMetadata: string, rewardAmount: bigint, validator: string, ev: ethers.ContractEventPayload) {
    const type = ev.fragment.name as ThriveWorkerUnitEventKey
    this.eventListener.emit(type, {
      type,
      contributor: contributor.toString(),
      validationMetadata: validationMetadata.toString(),
      rewardAmount: rewardAmount.toString(),
      validator: validator.toString(),
      token: '',
      amount: '',
      timestamp: 0,
      block: ev.log.blockNumber.toString(),
      tx: ev.log.transactionHash
    })
  }

  public onContractEvent (type: ThriveWorkerUnitEventKey, listener: ThriveWorkerUnitEventListener) {
    this.eventListener.addListener(type, listener)
    const count = this.eventListenerCount.get(type)!
    if (count === 0) {
      this.contract.on(type, this.eventListenerFunc.bind(this))
    }
    this.eventListenerCount.set(type, count + 1)
  }

  public offContractEvent (type: ThriveWorkerUnitEventKey, listener?: ThriveWorkerUnitEventListener) {
    if (listener) {
      this.eventListener.removeListener(type, listener)
      const count = this.eventListenerCount.get(type)! - 1
      if (count === 0) {
        this.contract.off(type)
      }
      if (count >= 0) {
        this.eventListenerCount.set(type, count)
      }
    } else {
      this.eventListener.removeAllListeners(type)
      this.contract.off(type)
      this.eventListenerCount.set(type, 0)
    }
  }
}
