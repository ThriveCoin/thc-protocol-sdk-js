import { ethers } from 'ethers';
import { EventEmitter } from 'events';
import { ThriveWorkerUnitOptions } from './ThriveWorkerUnit';
/**
 * Review configuration options – arguments used to initialize the review contract.
 */
export interface ThriveReviewOptions {
    workUnit: string;
    maximumSubmissions: number;
    maximumSubmissionsPerUser: number;
    submissionDeadline: number;
    reviewDeadlinePeriod: number;
    reviewCommitmentPeriod: number;
    minimumReviews: number;
    maximumReviewsPerSubmission: number;
    agreementThreshold: number;
    reviewerReward: string;
    reviewerRewardsTotalAllocation: string;
    judgeBadges: string[];
    reviewerBadges: string[];
    submitterBadges: string[];
}
/**
 * Reviewer event names (matching the Solidity events)
 */
export declare enum ThriveReviewEventEnum {
    SubmissionCreated = "SubmissionCreated",
    SubmissionUpdated = "SubmissionUpdated",
    ReviewCommitted = "ReviewCommitted",
    ReviewCreated = "ReviewCreated",
    SubmissionDecisionReached = "SubmissionDecisionReached",
    SubmissionDecisionReachedAsBadge = "SubmissionDecisionReachedAsBadge",
    FailedDistributionFundsClaimed = "FailedDistributionFundsClaimed",
    FundsRetrievedByOwner = "FundsRetrievedByOwner",
    PendingReviewDeleted = "PendingReviewDeleted"
}
export type ThriveReviewEventKey = keyof typeof ThriveReviewEventEnum;
/**
 * Event payload for emitted review events.
 */
export interface ThriveReviewEvent {
    type: ThriveReviewEventEnum;
    submissionId?: string;
    reviewId?: string;
    reviewer?: string;
    decision?: string;
    badgeHolder?: string;
    amount?: string;
    owner?: string;
    timestamp: number;
    block: string;
    tx: string;
}
/**
 * Event listener callback type.
 */
export type ThriveReviewEventListener = (event: ThriveReviewEvent) => void;
export declare class ThriveReview {
    protected wallet?: ethers.Wallet;
    protected provider?: ethers.Provider;
    protected contractAddress?: string;
    protected factoryAddress: string;
    protected contract?: ethers.Contract;
    protected factoryContract: ethers.Contract;
    protected eventInterface: ethers.Interface;
    protected eventListener: EventEmitter<Record<ThriveReviewEventEnum, [event: ThriveReviewEvent]>>;
    protected eventListenerCount: Map<ThriveReviewEventEnum, number>;
    /**
     * Constructor.
     *
     * @param _factoryAddress - Address of the ThriveReviewFactory contract.
     * @param _wallet - ethers Wallet instance.
     * @param _provider - ethers Provider instance.
     * @param _contractAddress - (Optional) Address of an already deployed ThriveReview contract.
     */
    constructor(_factoryAddress: string, _wallet: ethers.Wallet, _provider: ethers.Provider, _contractAddress?: string);
    /**
     * Set a new wallet.
     */
    setWallet(wallet: ethers.Wallet): void;
    /**
     * Returns the current wallet address.
     */
    getWallet(): string;
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
    createWorkUnitAndReviewContract(workUnitArgs: ThriveWorkerUnitOptions, reviewConfiguration: ThriveReviewOptions, thriveReviewOwner: string, value: string): Promise<{
        reviewContract: string;
        workUnitContract: string;
    }>;
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
    createReviewContract(reviewConfiguration: ThriveReviewOptions, thriveReviewOwner: string, value: string): Promise<string>;
    /**
     * Retrieves contract events from a transaction hash.
     *
     * @param hash - Transaction hash.
     * @returns Array of parsed ThriveReview event payloads.
    //  */
    getContractEventsFromHash(hash: string): Promise<ThriveReviewEvent[]>;
    /**
     * Internal event listener function.
     *
     * This function is bound to contract events and maps the event arguments into a strictly typed payload.
     */
    protected eventListenerFunc(...args: unknown[]): void;
    /**
     * Subscribe to contract events.
     *
     * @param type - The event name.
     * @param listener - The event listener callback.
     */
    onContractEvent(type: ThriveReviewEventEnum, listener: ThriveReviewEventListener): void;
    /**
     * Unsubscribe from contract events.
     *
     * @param type - The event name.
     * @param listener - (Optional) Specific listener to remove.
     */
    offContractEvent(type: ThriveReviewEventEnum, listener?: ThriveReviewEventListener): void;
    createSubmission(submissionMetadata: string, value: string): Promise<string>;
    updateSubmission(submissionId: number, submissionMetadata: string): Promise<string>;
    commitToReview(submissionId: number): Promise<string>;
    submitReview(reviewId: number, decision: number, reviewMetadata: string): Promise<string>;
    deletePendingReview(reviewId: number): Promise<string>;
    deletePendingReviews(reviewIds: number[]): Promise<string>;
    reachDecisionOnSubmissionAsJudge(submissionId: number, decision: number, judgeDecisionMetadata: string): Promise<string>;
    claimFailedDistributionFunds(): Promise<string>;
    retrieveFundsByOwner(): Promise<string>;
    raiseDisputeOnSubmission(submissionId: number, disputeMetadata: string): Promise<string>;
    resolveDisputeOnSubmission(submissionId: number, decision: number, disputeResolutionMetadata: string): Promise<string>;
    cancelDisputeOnSubmission(submissionId: number): Promise<string>;
    distributePayoutsForNonDisputedSubmissions(submissionIds: number[]): Promise<string>;
    distributePayoutsForNonDisputedSubmission(submissionId: number): Promise<string>;
    userHasPendingSubmission(user: string): Promise<boolean>;
    userHasAcceptedSubmission(user: string): Promise<boolean>;
    allSubmissionsPaidOut(): Promise<boolean>;
    getSubmissionDecision(submissionId: number): Promise<string>;
    getSubmissionStatus(submissionId: number): Promise<string>;
    hasWorkerUnitContract(): Promise<boolean>;
}
