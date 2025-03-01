import { ethers } from 'ethers'
import { EventEmitter } from 'events'

import ThriveWorkerUnitABI from './abis/ThriveWorkerUnit.json'
import ThriveWorkerUnitFactoryABI from './abis/ThriveWorkerUnitFactory.json'
import ThriveIERC20WrapperABI from './abis/ThriveIERC20Wrapper.json'
import ThriveWalletMissingError from './errors/ThriveWalletMissingError'
import ThriveProviderMissingError from './errors/ThriveProviderMissingError'
import ThriveProviderTxNotFoundError from './errors/ThriveProviderTxNotFoundError'
import ThriveContractNotInitializedError from './errors/ThriveContractNotInitializedError'

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
  moderator: string,
  rewardToken?: string,
  tokenType: ThriveWorkerUnitTokenType,
  rewardAmount: string,
  maxRewards: string,
  validationRewardAmount?: string,
  deadline: number,
  validationMetadata: string,
  metadataVersion: string,
  metadata: string,
  maxCompletionsPerUser: number,
  validators: Array<string>,
  assignedContributor: string,
  badgeQuery: string,
}

export class ThriveWorkerUnit {
  protected wallet?: ethers.Wallet
  protected provider?: ethers.Provider
  protected contractAddress?: string
  protected factoryAddress: string
  protected contract?: ethers.Contract
  protected factoryContract: ethers.Contract
  protected eventInterface: ethers.Interface
  protected eventListener: EventEmitter<Record<ThriveWorkerUnitEventKey, [event: ThriveWorkerUnitEvent]>>
  protected eventListenerCount = new Map<ThriveWorkerUnitEventKey, number>([
    [ThriveWorkerUnitEventEnum.Initialized, 0],
    [ThriveWorkerUnitEventEnum.ConfirmationAdded, 0],
    [ThriveWorkerUnitEventEnum.Withdrawn, 0]
  ])

  constructor (_factoryAddress: string, _wallet: ethers.Wallet, _provider: ethers.Provider, _contractAddress?: string) {
    this.wallet = _wallet
    this.provider = _provider
    this.contractAddress = _contractAddress
    this.factoryAddress = _factoryAddress

    this.factoryContract = new ethers.Contract(this.factoryAddress, ThriveWorkerUnitFactoryABI, this.wallet ?? this.provider)

    if (this.contractAddress) {
      this.contract = new ethers.Contract(this.contractAddress, ThriveWorkerUnitABI, this.wallet ?? this.provider)
    }

    this.eventInterface = new ethers.Interface(ThriveWorkerUnitABI.filter(x => x.type === 'event'))
    this.eventListener = new EventEmitter<Record<ThriveWorkerUnitEventKey, [event: ThriveWorkerUnitEvent]>>({ captureRejections: true })
  }

  public setWallet (wallet: ethers.Wallet) {
    this.wallet = wallet
    this.contract = this.contract?.connect(this.wallet) as ethers.Contract
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

  public async createNewWorkerUnit (workerUnitOptions: ThriveWorkerUnitOptions): Promise<string> {
    if (!this.wallet) {
      throw new ThriveWalletMissingError()
    }
    if (!this.factoryContract) {
      throw new Error('Factory contract is not deployed')
    }
    if (workerUnitOptions.rewardToken && workerUnitOptions.rewardToken !== ethers.ZeroAddress) {
      const tokenContract = new ethers.Contract(workerUnitOptions.rewardToken, ThriveIERC20WrapperABI, this.wallet)
      const approvalTx = await tokenContract.approve(this.factoryContract.address, workerUnitOptions.maxRewards)
      await approvalTx.wait()
    }
    const requiredNativeFunds = await this.factoryContract.getRequiredNativeFunds(
      workerUnitOptions.rewardAmount,
      workerUnitOptions.maxRewards,
      workerUnitOptions.validationRewardAmount,
      workerUnitOptions.rewardToken ?? ethers.ZeroAddress
    )
    const tx = await this.factoryContract.createThriveWorkUnit(
      {
        moderator: workerUnitOptions.moderator,
        rewardToken: workerUnitOptions.rewardToken ?? ethers.ZeroAddress,
        rewardAmount: workerUnitOptions.rewardAmount,
        maxRewards: workerUnitOptions.maxRewards,
        validationRewardAmount: workerUnitOptions.validationRewardAmount,
        deadline: workerUnitOptions.deadline,
        validationMetadata: workerUnitOptions.validationMetadata,
        metadataVersion: workerUnitOptions.metadataVersion,
        metadata: workerUnitOptions.metadata,
        maxCompletionsPerUser: workerUnitOptions.maxCompletionsPerUser,
        validators: workerUnitOptions.validators,
        assignedContributor: workerUnitOptions.assignedContributor,
        badgeQuery: workerUnitOptions.badgeQuery
      },
      {
        value: requiredNativeFunds
      }
    )
    const receipt = await tx.wait()
    const eventInterface = new ethers.Interface([
      'event ThriveWorkerUnitCreated(address indexed unitAddress)'
    ])

    let newContractAddress: string | null = null

    receipt.logs.forEach((log: { topics: ReadonlyArray<string>; data: string }) => {
      try {
        const parsedLog = eventInterface.parseLog(log)
        if (parsedLog?.name === 'ThriveWorkerUnitCreated') {
          newContractAddress = parsedLog.args.unitAddress
        }
      } catch (error) {
        console.error(error)
      }
    })

    if (!newContractAddress) {
      throw new Error('Failed to retrieve new Worker Unit address')
    }

    this.contractAddress = newContractAddress
    this.contract = new ethers.Contract(newContractAddress, ThriveWorkerUnitABI, this.wallet ?? this.provider)
    const tokenContract = new ethers.Contract(workerUnitOptions.rewardToken ?? ethers.ZeroAddress, ThriveIERC20WrapperABI, this.wallet ?? this.provider)
    if (workerUnitOptions.tokenType === ThriveWorkerUnitTokenType.IERC20) {
      const ercTx = await tokenContract!.approve(this.contract, workerUnitOptions.maxRewards)
      await ercTx.wait()
    }
    return newContractAddress
  }

  public async getContractEventsFromHash (hash: string): Promise<ThriveWorkerUnitEvent[]> {
    if (!this.provider) {
      throw new ThriveProviderMissingError()
    }
    const receipt = await this.provider.getTransactionReceipt(hash)
    if (!receipt) {
      throw new ThriveProviderTxNotFoundError()
    }

    const address = await this.contract?.getAddress()
    const events: ThriveWorkerUnitEvent[] = []

    receipt.logs.forEach((log) => {
      if (log.address.toLowerCase() !== address?.toLowerCase()) {
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
      this.contract?.on(type, this.eventListenerFunc.bind(this))
    }
    this.eventListenerCount.set(type, count + 1)
  }

  public offContractEvent (type: ThriveWorkerUnitEventKey, listener?: ThriveWorkerUnitEventListener) {
    if (listener) {
      this.eventListener.removeListener(type, listener)
      const count = this.eventListenerCount.get(type)! - 1
      if (count === 0) {
        this.contract?.off(type)
      }
      if (count >= 0) {
        this.eventListenerCount.set(type, count)
      }
    } else {
      this.eventListener.removeAllListeners(type)
      this.contract?.off(type)
      this.eventListenerCount.set(type, 0)
    }
  }

  public async initialize (
    value: string
  ): Promise<string> {
    if (!this.wallet) throw new ThriveWalletMissingError()
    if (!this.contract) throw new ThriveContractNotInitializedError()
    const tx = await this.contract.initialize({
      value
    })

    await tx.wait()

    return tx.hash
  }

  public async confirm (
    contributor: string,
    inputValidationMetadata: string
  ): Promise<string> {
    if (!this.wallet) throw new ThriveWalletMissingError()
    if (!this.contract) throw new ThriveContractNotInitializedError()

    const tx = await this.contract.confirm(
      contributor,
      inputValidationMetadata
    )
    await tx.wait()

    return tx.hash
  }

  public async setAssignedContributor (contributor: string): Promise<string> {
    if (!this.wallet) throw new ThriveWalletMissingError()
    if (!this.contract) throw new ThriveContractNotInitializedError()

    const tx = await this.contract.setAssignedContributor(contributor)
    await tx.wait()

    return tx.hash
  }

  public async addRequiredBadge (badge: string): Promise<string> {
    if (!this.wallet) throw new ThriveWalletMissingError()
    if (!this.contract) throw new ThriveContractNotInitializedError()

    const tx = await this.contract.addRequiredBadge(badge)
    await tx.wait()

    return tx.hash
  }

  public async removeRequiredBadge (badge: string): Promise<string> {
    if (!this.wallet) throw new ThriveWalletMissingError()
    if (!this.contract) throw new ThriveContractNotInitializedError()

    const tx = await this.contract.removeRequiredBadge(badge)
    await tx.wait()

    return tx.hash
  }

  public async setMetadata (
    metadata: string,
    metadataVersion: string
  ): Promise<string> {
    if (!this.wallet) throw new ThriveWalletMissingError()
    if (!this.contract) throw new ThriveContractNotInitializedError()

    const metadataTx = await this.contract.setMetadata(metadata)
    const versionTx = await this.contract.setMetadataVersion(metadataVersion)

    await metadataTx.wait()
    await versionTx.wait()

    return JSON.stringify({
      metadata: metadataTx.hash,
      metadataVersion: versionTx.hash
    })
  }

  public async setDeadline (deadline: number): Promise<string> {
    if (!this.wallet) throw new ThriveWalletMissingError()
    if (!this.contract) throw new ThriveContractNotInitializedError()

    const tx = await this.contract.setDeadline(deadline)
    await tx.wait()

    return tx.hash
  }

  public async withdrawRemaining (): Promise<string> {
    if (!this.wallet) throw new ThriveWalletMissingError()
    if (!this.contract) throw new ThriveContractNotInitializedError()

    const tx = await this.contract.withdrawRemaining()
    await tx.wait()

    return tx.hash
  }

  public async getValidators (): Promise<string[]> {
    if (!this.contract) throw new ThriveContractNotInitializedError()
    return await this.contract.getValidators()
  }

  public async getRequiredBadges (): Promise<string[]> {
    if (!this.contract) throw new ThriveContractNotInitializedError()
    return await this.contract.getRequiredBadges()
  }

  public async status (): Promise<string> {
    if (!this.contract) throw new ThriveContractNotInitializedError()
    return await this.contract.status()
  }
}
