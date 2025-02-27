import { ethers } from 'ethers'
import { EventEmitter } from 'events'
import { ThriveWorkerUnitOptions } from './ThriveWorkerUnit'

import ThriveReviewABI from './abis/ThriveReview.json'
import ThriveReviewFactoryABI from './abis/ThriveReviewFactory.json'

import ThriveWalletMissingError from './errors/ThriveWalletMissingError'
import ThriveProviderMissingError from './errors/ThriveProviderMissingError'
import ThriveContractNotInitializedError from './errors/ThriveContractNotInitializedError'
import ThriveProviderTxNotFoundError from './errors/ThriveProviderTxNotFoundError'

/**
 * Review configuration options – arguments used to initialize the review contract.
 */
export interface ThriveReviewOptions {
  workUnit: string
  maximumSubmissions: number
  maximumSubmissionsPerUser: number
  submissionDeadline: number
  reviewDeadlinePeriod: number
  reviewCommitmentPeriod: number
  minimumReviews: number
  maximumReviewsPerSubmission: number
  agreementThreshold: number
  reviewerReward: string
  reviewerRewardsTotalAllocation: string
  judgeBadges: string[]
  reviewerBadges: string[]
  submitterBadges: string[]
}

/**
 * Reviewer event names (matching the Solidity events)
 */
export enum ThriveReviewEventEnum {
  SubmissionCreated = 'SubmissionCreated',
  SubmissionUpdated = 'SubmissionUpdated',
  ReviewCommitted = 'ReviewCommitted',
  ReviewCreated = 'ReviewCreated',
  SubmissionDecisionReached = 'SubmissionDecisionReached',
  SubmissionDecisionReachedAsBadge = 'SubmissionDecisionReachedAsBadge',
  FailedDistributionFundsClaimed = 'FailedDistributionFundsClaimed',
  FundsRetrievedByOwner = 'FundsRetrievedByOwner',
  PendingReviewDeleted = 'PendingReviewDeleted'
}

export type ThriveReviewEventKey = keyof typeof ThriveReviewEventEnum

/**
 * Event payload for emitted review events.
 */
export interface ThriveReviewEvent {
  type: ThriveReviewEventEnum
  submissionId?: string
  reviewId?: string
  reviewer?: string
  decision?: string
  badgeHolder?: string
  amount?: string
  owner?: string
  timestamp: number
  block: string
  tx: string
}

/**
 * Event listener callback type.
 */
export type ThriveReviewEventListener = (event: ThriveReviewEvent) => void

/* -------------------------------
   ThriveReview SDK Class
--------------------------------- */
export class ThriveReview {
  protected wallet?: ethers.Wallet
  protected provider?: ethers.Provider
  protected contractAddress?: string
  protected factoryAddress: string
  protected contract?: ethers.Contract
  protected factoryContract: ethers.Contract
  protected eventInterface: ethers.Interface
  protected eventListener: EventEmitter<Record<ThriveReviewEventEnum, [event: ThriveReviewEvent]>>
  protected eventListenerCount = new Map<ThriveReviewEventEnum, number>([
    [ThriveReviewEventEnum.SubmissionCreated, 0],
    [ThriveReviewEventEnum.SubmissionUpdated, 0],
    [ThriveReviewEventEnum.ReviewCommitted, 0],
    [ThriveReviewEventEnum.ReviewCreated, 0],
    [ThriveReviewEventEnum.SubmissionDecisionReached, 0],
    [ThriveReviewEventEnum.SubmissionDecisionReachedAsBadge, 0],
    [ThriveReviewEventEnum.FailedDistributionFundsClaimed, 0],
    [ThriveReviewEventEnum.FundsRetrievedByOwner, 0],
    [ThriveReviewEventEnum.PendingReviewDeleted, 0]
  ])

  /**
   * Constructor.
   *
   * @param _factoryAddress - Address of the ThriveReviewFactory contract.
   * @param _wallet - ethers Wallet instance.
   * @param _provider - ethers Provider instance.
   * @param _contractAddress - (Optional) Address of an already deployed ThriveReview contract.
   */
  constructor (
    _factoryAddress: string,
    _wallet: ethers.Wallet,
    _provider: ethers.Provider,
    _contractAddress?: string
  ) {
    this.wallet = _wallet
    this.provider = _provider
    this.contractAddress = _contractAddress
    this.factoryAddress = _factoryAddress

    this.factoryContract = new ethers.Contract(
      this.factoryAddress,
      ThriveReviewFactoryABI,
      this.wallet ?? this.provider
    )

    if (this.contractAddress) {
      this.contract = new ethers.Contract(
        this.contractAddress,
        ThriveReviewABI,
        this.wallet ?? this.provider
      )
    }

    this.eventInterface = new ethers.Interface(
      (ThriveReviewABI).filter((x) => x.type === 'event')
    )
    this.eventListener = new EventEmitter<Record<ThriveReviewEventEnum, [event: ThriveReviewEvent]>>({
      captureRejections: true
    })
  }

  /**
   * Set a new wallet.
   */
  public setWallet (wallet: ethers.Wallet): void {
    this.wallet = wallet
    if (this.contract) {
      this.contract = this.contract.connect(wallet) as ethers.Contract
    }
    if (this.factoryContract) {
      this.factoryContract = this.factoryContract.connect(wallet) as ethers.Contract
    }
  }

  /**
   * Returns the current wallet address.
   */
  public getWallet (): string {
    if (!this.wallet) throw new ThriveWalletMissingError()
    return this.wallet.address
  }

  /**
   * Creates new Worker Unit and Review contracts.
   *
   * Calls the factory’s createWorkUnitAndReviewContract function.
   *
   * @param workUnitArgs - Arguments for initializing the Worker Unit.
   * @param reviewConfiguration - Configuration for the review process.
   * @param thriveReviewOwner - Owner address for the newly created Review contract.
   * @param value - Total amount (in wei) to send with the transaction.
   * @returns An object containing the new Review contract address and the new Worker Unit contract address.
   */
  public async createWorkUnitAndReviewContract (
    workUnitArgs: ThriveWorkerUnitOptions,
    reviewConfiguration: ThriveReviewOptions,
    thriveReviewOwner: string,
    value: string
  ): Promise<{ reviewContract: string; workUnitContract: string }> {
    if (!this.wallet) throw new ThriveWalletMissingError()
    if (!this.factoryContract) throw new Error('Factory contract is not deployed')

    const tx = await this.factoryContract.createWorkUnitAndReviewContract(
      workUnitArgs,
      reviewConfiguration,
      thriveReviewOwner,
      { value }
    )
    const receipt = await tx.wait()

    const eventInterface = new ethers.Interface([
      'event WorkUnitAndReviewCreated(address indexed reviewContract, address indexed workUnitContract)'
    ])

    let reviewContractAddress: string | null = null
    let workUnitContractAddress: string | null = null

    receipt.logs.forEach((log: { topics: ReadonlyArray<string>; data: string }) => {
      try {
        const parsedLog = eventInterface.parseLog(log)
        if (parsedLog?.name === 'WorkUnitAndReviewCreated') {
          reviewContractAddress = parsedLog.args.reviewContract
          workUnitContractAddress = parsedLog.args.workUnitContract
        }
      } catch (error) {
        console.error(error)
      }
    })

    if (!reviewContractAddress || !workUnitContractAddress) {
      throw new Error('Failed to retrieve new contracts')
    }

    return { reviewContract: reviewContractAddress, workUnitContract: workUnitContractAddress }
  }

  /**
   * Creates a new Review contract without a Worker Unit connection.
   *
   * Calls the factory’s createReviewContract function.
   *
   * @param reviewConfiguration - Configuration for the review process.
   * @param thriveReviewOwner - Owner address for the new Review contract.
   * @param value - Amount (in wei) to send with the transaction.
   * @returns The address of the newly created Review contract.
   */
  public async createReviewContract (
    reviewConfiguration: ThriveReviewOptions,
    thriveReviewOwner: string,
    value: string
  ): Promise<string> {
    if (!this.wallet) throw new ThriveWalletMissingError()
    if (!this.factoryContract) throw new Error('Factory contract is not deployed')

    const tx = await this.factoryContract.createReviewContract(
      reviewConfiguration,
      thriveReviewOwner,
      { value }
    )
    const receipt = await tx.wait()

    const eventInterface = new ethers.Interface([
      'event ReviewContractCreated(address indexed reviewContract)'
    ])

    let reviewContractAddress: string | null = null
    receipt.logs.forEach((log: { topics: ReadonlyArray<string>; data: string }) => {
      try {
        const parsedLog = eventInterface.parseLog(log)
        if (parsedLog?.name === 'ReviewContractCreated') {
          reviewContractAddress = parsedLog.args.reviewContract
        }
      } catch (error) {
        console.error(error)
      }
    })

    if (!reviewContractAddress) {
      throw new Error('Failed to retrieve new Review contract address')
    }

    return reviewContractAddress
  }

  /**
   * Retrieves contract events from a transaction hash.
   *
   * @param hash - Transaction hash.
   * @returns Array of parsed ThriveReview event payloads.
  //  */
  public async getContractEventsFromHash (hash: string): Promise<ThriveReviewEvent[]> {
    if (!this.provider) throw new ThriveProviderMissingError()
    const receipt = await this.provider.getTransactionReceipt(hash)
    if (!receipt) throw new ThriveProviderTxNotFoundError()
    const events: ThriveReviewEvent[] = []
    const contractAddress = this.contract?.address.toString().toLowerCase()
    receipt.logs.forEach(log => {
      if (log.address.toLowerCase() !== contractAddress) return
      try {
        const parsed = this.eventInterface.parseLog(log)
        const type = parsed?.fragment.name as ThriveReviewEventEnum
        const payload: ThriveReviewEvent = {
          type,
          timestamp: Date.now(),
          block: log.blockNumber.toString(),
          tx: log.transactionHash
        }
        switch (type) {
          case ThriveReviewEventEnum.SubmissionCreated:
          case ThriveReviewEventEnum.SubmissionUpdated:
            payload.submissionId = parsed?.args[0]?.toString()
            break
          case ThriveReviewEventEnum.ReviewCommitted:
            payload.reviewId = parsed?.args[0]?.toString()
            payload.submissionId = parsed?.args[1]?.toString()
            payload.reviewer = parsed?.args[2]?.toString()
            break
          case ThriveReviewEventEnum.ReviewCreated:
            payload.reviewId = parsed?.args[0]?.toString()
            break
          case ThriveReviewEventEnum.SubmissionDecisionReached:
            payload.submissionId = parsed?.args[0]?.toString()
            payload.decision = parsed?.args[1]?.toString()
            break
          case ThriveReviewEventEnum.SubmissionDecisionReachedAsBadge:
            payload.submissionId = parsed?.args[0]?.toString()
            payload.decision = parsed?.args[1]?.toString()
            payload.badgeHolder = parsed?.args[2]?.toString()
            break
          case ThriveReviewEventEnum.FailedDistributionFundsClaimed:
            payload.reviewer = parsed?.args[0]?.toString()
            payload.amount = parsed?.args[1]?.toString()
            break
          case ThriveReviewEventEnum.FundsRetrievedByOwner:
            payload.owner = parsed?.args[0]?.toString()
            payload.amount = parsed?.args[1]?.toString()
            break
          case ThriveReviewEventEnum.PendingReviewDeleted:
            payload.reviewId = parsed?.args[0]?.toString()
            payload.reviewer = parsed?.args[1]?.toString()
            payload.submissionId = parsed?.args[2]?.toString()
            break
        }
        events.push(payload)
      } catch { /* Skip logs that cannot be parsed */ }
    })
    return events
  }

  /**
   * Internal event listener function.
   *
   * This function is bound to contract events and maps the event arguments into a strictly typed payload.
   */
  protected eventListenerFunc (...args: unknown[]): void {
    const ev = args[args.length - 1] as ethers.ContractEventPayload
    const type = (ev as { fragment: { name: string } }).fragment.name as ThriveReviewEventEnum
    const timestamp = Date.now()
    const payload: ThriveReviewEvent = {
      type,
      timestamp,
      block: ev.log.blockNumber.toString(),
      tx: ev.log.transactionHash
    }
    if (type === ThriveReviewEventEnum.SubmissionCreated || type === ThriveReviewEventEnum.SubmissionUpdated) {
      payload.submissionId = String(args[0])
    } else if (type === ThriveReviewEventEnum.ReviewCommitted) {
      payload.reviewId = String(args[0])
      payload.submissionId = String(args[1])
      payload.reviewer = String(args[2])
    } else if (type === ThriveReviewEventEnum.ReviewCreated) {
      payload.reviewId = String(args[0])
    } else if (type === ThriveReviewEventEnum.SubmissionDecisionReached) {
      payload.submissionId = String(args[0])
      payload.decision = String(args[1])
    } else if (type === ThriveReviewEventEnum.SubmissionDecisionReachedAsBadge) {
      payload.submissionId = String(args[0])
      payload.decision = String(args[1])
      payload.badgeHolder = String(args[2])
    } else if (type === ThriveReviewEventEnum.FailedDistributionFundsClaimed) {
      payload.reviewer = String(args[0])
      payload.amount = String(args[1])
    } else if (type === ThriveReviewEventEnum.FundsRetrievedByOwner) {
      payload.owner = String(args[0])
      payload.amount = String(args[1])
    } else if (type === ThriveReviewEventEnum.PendingReviewDeleted) {
      payload.reviewId = String(args[0])
      payload.reviewer = String(args[1])
      payload.submissionId = String(args[2])
    }
    this.eventListener.emit(type, payload)
  }

  /**
   * Subscribe to contract events.
   *
   * @param type - The event name.
   * @param listener - The event listener callback.
   */
  public onContractEvent (type: ThriveReviewEventEnum, listener: ThriveReviewEventListener): void {
    this.eventListener.addListener(type, listener)
    const count = this.eventListenerCount.get(type) || 0
    if (count === 0 && this.contract) {
      this.contract.on(type, this.eventListenerFunc.bind(this))
    }
    this.eventListenerCount.set(type, count + 1)
  }

  /**
   * Unsubscribe from contract events.
   *
   * @param type - The event name.
   * @param listener - (Optional) Specific listener to remove.
   */
  public offContractEvent (type: ThriveReviewEventEnum, listener?: ThriveReviewEventListener): void {
    if (listener) {
      this.eventListener.removeListener(type, listener)
      let count = (this.eventListenerCount.get(type) || 0) - 1
      if (count <= 0 && this.contract) {
        this.contract.off(type)
        count = 0
      }
      this.eventListenerCount.set(type, count)
    } else {
      this.eventListener.removeAllListeners(type)
      if (this.contract) {
        this.contract.off(type)
      }
      this.eventListenerCount.set(type, 0)
    }
  }

  public async createSubmission (submissionMetadata: string, value: string): Promise<string> {
    if (!this.wallet) throw new ThriveWalletMissingError()
    if (!this.contract) throw new ThriveContractNotInitializedError()
    const tx = await this.contract.createSubmission({ submissionMetadata }, { value })

    await tx.wait()

    return tx.hash
  }

  public async updateSubmission (submissionId: number, submissionMetadata: string): Promise<string> {
    if (!this.wallet) throw new ThriveWalletMissingError()
    if (!this.contract) throw new ThriveContractNotInitializedError()
    const tx = await this.contract.updateSubmission(submissionMetadata, submissionId)

    await tx.wait()

    return tx.hash
  }

  public async commitToReview (submissionId: number): Promise<string> {
    if (!this.wallet) throw new ThriveWalletMissingError()
    if (!this.contract) throw new ThriveContractNotInitializedError()
    const tx = await this.contract.commitToReview(submissionId)

    await tx.wait()

    return tx.hash
  }

  public async submitReview (reviewId: number, decision: number, reviewMetadata: string): Promise<string> {
    if (!this.wallet) throw new ThriveWalletMissingError()
    if (!this.contract) throw new ThriveContractNotInitializedError()
    const review = { id: reviewId, decision, reviewMetadata }
    const tx = await this.contract.submitReview(review)

    await tx.wait()

    return tx.hash
  }

  public async deletePendingReview (reviewId: number): Promise<string> {
    if (!this.wallet) throw new ThriveWalletMissingError()
    if (!this.contract) throw new ThriveContractNotInitializedError()
    const tx = await this.contract.deletePendingReview(reviewId)

    await tx.wait()

    return tx.hash
  }

  public async deletePendingReviews (reviewIds: number[]): Promise<string> {
    if (!this.wallet) throw new ThriveWalletMissingError()
    if (!this.contract) throw new ThriveContractNotInitializedError()
    const tx = await this.contract.deletePendingReviews(reviewIds)

    await tx.wait()

    return tx.hash
  }

  public async reachDecisionOnSubmissionAsJudge (
    submissionId: number,
    decision: number,
    judgeDecisionMetadata: string
  ): Promise<string> {
    if (!this.wallet) throw new ThriveWalletMissingError()
    if (!this.contract) throw new ThriveContractNotInitializedError()
    const tx = await this.contract.reachDecisionOnSubmissionAsJudge(submissionId, decision, judgeDecisionMetadata)

    await tx.wait()

    return tx.hash
  }

  public async claimFailedDistributionFunds (): Promise<string> {
    if (!this.wallet) throw new ThriveWalletMissingError()
    if (!this.contract) throw new ThriveContractNotInitializedError()
    const tx = await this.contract.claimFailedDistributionFunds()

    await tx.wait()

    return tx.hash
  }

  public async retrieveFundsByOwner (): Promise<string> {
    if (!this.wallet) throw new ThriveWalletMissingError()
    if (!this.contract) throw new ThriveContractNotInitializedError()
    const tx = await this.contract.retrieveFundsByOwner()

    await tx.wait()

    return tx.hash
  }

  // -------------------------------
  // DISPUTE FUNCTIONALITY
  // -------------------------------

  public async raiseDisputeOnSubmission (submissionId: number, disputeMetadata: string): Promise<string> {
    if (!this.wallet) throw new ThriveWalletMissingError()
    if (!this.contract) throw new ThriveContractNotInitializedError()
    const tx = await this.contract.raiseDisputeOnSubmission(submissionId, disputeMetadata)

    await tx.wait()

    return tx.hash
  }

  public async resolveDisputeOnSubmission (
    submissionId: number,
    decision: number,
    disputeResolutionMetadata: string
  ): Promise<string> {
    if (!this.wallet) throw new ThriveWalletMissingError()
    if (!this.contract) throw new ThriveContractNotInitializedError()
    const tx = await this.contract.resolveDisputeOnSubmission(submissionId, decision, disputeResolutionMetadata)

    await tx.wait()

    return tx.hash
  }

  public async cancelDisputeOnSubmission (submissionId: number): Promise<string> {
    if (!this.wallet) throw new ThriveWalletMissingError()
    if (!this.contract) throw new ThriveContractNotInitializedError()
    const tx = await this.contract.cancelDisputeOnSubmission(submissionId)

    await tx.wait()

    return tx.hash
  }

  public async distributePayoutsForNonDisputedSubmissions (submissionIds: number[]): Promise<string> {
    if (!this.wallet) throw new ThriveWalletMissingError()
    if (!this.contract) throw new ThriveContractNotInitializedError()
    const tx = await this.contract.distributePayoutsForNonDisputedSubmissions(submissionIds)

    await tx.wait()

    return tx.hash
  }

  public async distributePayoutsForNonDisputedSubmission (submissionId: number): Promise<string> {
    if (!this.wallet) throw new ThriveWalletMissingError()
    if (!this.contract) throw new ThriveContractNotInitializedError()
    const tx = await this.contract.distributePayoutsForNonDisputedSubmission(submissionId)

    await tx.wait()

    return tx.hash
  }

  // -------------------------------
  // VIEW FUNCTIONS
  // -------------------------------

  public async userHasPendingSubmission (user: string): Promise<boolean> {
    if (!this.contract) throw new ThriveContractNotInitializedError()
    return await this.contract.userHasPendingSubmission(user)
  }

  public async userHasAcceptedSubmission (user: string): Promise<boolean> {
    if (!this.contract) throw new ThriveContractNotInitializedError()
    return await this.contract.userHasAcceptedSubmission(user)
  }

  public async allSubmissionsPaidOut (): Promise<boolean> {
    if (!this.contract) throw new ThriveContractNotInitializedError()
    return await this.contract.allSubmissionsPaidOut()
  }

  public async getSubmissionDecision (submissionId: number): Promise<string> {
    if (!this.contract) throw new ThriveContractNotInitializedError()
    return await this.contract.getSubmissionDecision(submissionId)
  }

  public async getSubmissionStatus (submissionId: number): Promise<string> {
    if (!this.contract) throw new ThriveContractNotInitializedError()
    return await this.contract.getSubmissionStatus(submissionId)
  }

  public async hasWorkerUnitContract (): Promise<boolean> {
    if (!this.contract) throw new ThriveContractNotInitializedError()
    return await this.contract.hasWorkerUnitContract()
  }
}
