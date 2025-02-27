import { ethers } from 'ethers';
import { EventEmitter } from 'events';
import ThriveReviewABI from './abis/ThriveReview.json';
import ThriveReviewFactoryABI from './abis/ThriveReviewFactory.json';
import ThriveWalletMissingError from './errors/ThriveWalletMissingError';
import ThriveProviderMissingError from './errors/ThriveProviderMissingError';
import ThriveContractNotInitializedError from './errors/ThriveContractNotInitializedError';
import ThriveProviderTxNotFoundError from './errors/ThriveProviderTxNotFoundError';
/**
 * Reviewer event names (matching the Solidity events)
 */
export var ThriveReviewEventEnum;
(function (ThriveReviewEventEnum) {
    ThriveReviewEventEnum["SubmissionCreated"] = "SubmissionCreated";
    ThriveReviewEventEnum["SubmissionUpdated"] = "SubmissionUpdated";
    ThriveReviewEventEnum["ReviewCommitted"] = "ReviewCommitted";
    ThriveReviewEventEnum["ReviewCreated"] = "ReviewCreated";
    ThriveReviewEventEnum["SubmissionDecisionReached"] = "SubmissionDecisionReached";
    ThriveReviewEventEnum["SubmissionDecisionReachedAsBadge"] = "SubmissionDecisionReachedAsBadge";
    ThriveReviewEventEnum["FailedDistributionFundsClaimed"] = "FailedDistributionFundsClaimed";
    ThriveReviewEventEnum["FundsRetrievedByOwner"] = "FundsRetrievedByOwner";
    ThriveReviewEventEnum["PendingReviewDeleted"] = "PendingReviewDeleted";
})(ThriveReviewEventEnum || (ThriveReviewEventEnum = {}));
/* -------------------------------
   ThriveReview SDK Class
--------------------------------- */
export class ThriveReview {
    /**
     * Constructor.
     *
     * @param _factoryAddress - Address of the ThriveReviewFactory contract.
     * @param _wallet - ethers Wallet instance.
     * @param _provider - ethers Provider instance.
     * @param _contractAddress - (Optional) Address of an already deployed ThriveReview contract.
     */
    constructor(_factoryAddress, _wallet, _provider, _contractAddress) {
        this.eventListenerCount = new Map([
            [ThriveReviewEventEnum.SubmissionCreated, 0],
            [ThriveReviewEventEnum.SubmissionUpdated, 0],
            [ThriveReviewEventEnum.ReviewCommitted, 0],
            [ThriveReviewEventEnum.ReviewCreated, 0],
            [ThriveReviewEventEnum.SubmissionDecisionReached, 0],
            [ThriveReviewEventEnum.SubmissionDecisionReachedAsBadge, 0],
            [ThriveReviewEventEnum.FailedDistributionFundsClaimed, 0],
            [ThriveReviewEventEnum.FundsRetrievedByOwner, 0],
            [ThriveReviewEventEnum.PendingReviewDeleted, 0]
        ]);
        this.wallet = _wallet;
        this.provider = _provider;
        this.contractAddress = _contractAddress;
        this.factoryAddress = _factoryAddress;
        this.factoryContract = new ethers.Contract(this.factoryAddress, ThriveReviewFactoryABI, this.wallet ?? this.provider);
        if (this.contractAddress) {
            this.contract = new ethers.Contract(this.contractAddress, ThriveReviewABI, this.wallet ?? this.provider);
        }
        this.eventInterface = new ethers.Interface((ThriveReviewABI).filter((x) => x.type === 'event'));
        this.eventListener = new EventEmitter({
            captureRejections: true
        });
    }
    /**
     * Set a new wallet.
     */
    setWallet(wallet) {
        this.wallet = wallet;
        if (this.contract) {
            this.contract = this.contract.connect(wallet);
        }
        if (this.factoryContract) {
            this.factoryContract = this.factoryContract.connect(wallet);
        }
    }
    /**
     * Returns the current wallet address.
     */
    getWallet() {
        if (!this.wallet)
            throw new ThriveWalletMissingError();
        return this.wallet.address;
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
    async createWorkUnitAndReviewContract(workUnitArgs, reviewConfiguration, thriveReviewOwner, value) {
        if (!this.wallet)
            throw new ThriveWalletMissingError();
        if (!this.factoryContract)
            throw new Error('Factory contract is not deployed');
        const tx = await this.factoryContract.createWorkUnitAndReviewContract(workUnitArgs, reviewConfiguration, thriveReviewOwner, { value });
        const receipt = await tx.wait();
        const eventInterface = new ethers.Interface([
            'event WorkUnitAndReviewCreated(address indexed reviewContract, address indexed workUnitContract)'
        ]);
        let reviewContractAddress = null;
        let workUnitContractAddress = null;
        receipt.logs.forEach((log) => {
            try {
                const parsedLog = eventInterface.parseLog(log);
                if (parsedLog?.name === 'WorkUnitAndReviewCreated') {
                    reviewContractAddress = parsedLog.args.reviewContract;
                    workUnitContractAddress = parsedLog.args.workUnitContract;
                }
            }
            catch (error) {
                console.error(error);
            }
        });
        if (!reviewContractAddress || !workUnitContractAddress) {
            throw new Error('Failed to retrieve new contracts');
        }
        return { reviewContract: reviewContractAddress, workUnitContract: workUnitContractAddress };
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
    async createReviewContract(reviewConfiguration, thriveReviewOwner, value) {
        if (!this.wallet)
            throw new ThriveWalletMissingError();
        if (!this.factoryContract)
            throw new Error('Factory contract is not deployed');
        const tx = await this.factoryContract.createReviewContract(reviewConfiguration, thriveReviewOwner, { value });
        const receipt = await tx.wait();
        const eventInterface = new ethers.Interface([
            'event ReviewContractCreated(address indexed reviewContract)'
        ]);
        let reviewContractAddress = null;
        receipt.logs.forEach((log) => {
            try {
                const parsedLog = eventInterface.parseLog(log);
                if (parsedLog?.name === 'ReviewContractCreated') {
                    reviewContractAddress = parsedLog.args.reviewContract;
                }
            }
            catch (error) {
                console.error(error);
            }
        });
        if (!reviewContractAddress) {
            throw new Error('Failed to retrieve new Review contract address');
        }
        return reviewContractAddress;
    }
    /**
     * Retrieves contract events from a transaction hash.
     *
     * @param hash - Transaction hash.
     * @returns Array of parsed ThriveReview event payloads.
    //  */
    async getContractEventsFromHash(hash) {
        if (!this.provider)
            throw new ThriveProviderMissingError;
        const receipt = await this.provider.getTransactionReceipt(hash);
        if (!receipt)
            throw new ThriveProviderTxNotFoundError;
        const events = [];
        const contractAddress = this.contract?.address.toString().toLowerCase();
        receipt.logs.forEach(log => {
            if (log.address.toLowerCase() !== contractAddress)
                return;
            try {
                const parsed = this.eventInterface.parseLog(log);
                const type = parsed?.fragment.name;
                const payload = {
                    type,
                    timestamp: Date.now(),
                    block: log.blockNumber.toString(),
                    tx: log.transactionHash
                };
                switch (type) {
                    case ThriveReviewEventEnum.SubmissionCreated:
                    case ThriveReviewEventEnum.SubmissionUpdated:
                        payload.submissionId = parsed?.args[0]?.toString();
                        break;
                    case ThriveReviewEventEnum.ReviewCommitted:
                        payload.reviewId = parsed?.args[0]?.toString();
                        payload.submissionId = parsed?.args[1]?.toString();
                        payload.reviewer = parsed?.args[2]?.toString();
                        break;
                    case ThriveReviewEventEnum.ReviewCreated:
                        payload.reviewId = parsed?.args[0]?.toString();
                        break;
                    case ThriveReviewEventEnum.SubmissionDecisionReached:
                        payload.submissionId = parsed?.args[0]?.toString();
                        payload.decision = parsed?.args[1]?.toString();
                        break;
                    case ThriveReviewEventEnum.SubmissionDecisionReachedAsBadge:
                        payload.submissionId = parsed?.args[0]?.toString();
                        payload.decision = parsed?.args[1]?.toString();
                        payload.badgeHolder = parsed?.args[2]?.toString();
                        break;
                    case ThriveReviewEventEnum.FailedDistributionFundsClaimed:
                        payload.reviewer = parsed?.args[0]?.toString();
                        payload.amount = parsed?.args[1]?.toString();
                        break;
                    case ThriveReviewEventEnum.FundsRetrievedByOwner:
                        payload.owner = parsed?.args[0]?.toString();
                        payload.amount = parsed?.args[1]?.toString();
                        break;
                    case ThriveReviewEventEnum.PendingReviewDeleted:
                        payload.reviewId = parsed?.args[0]?.toString();
                        payload.reviewer = parsed?.args[1]?.toString();
                        payload.submissionId = parsed?.args[2]?.toString();
                        break;
                }
                events.push(payload);
            }
            catch { /* Skip logs that cannot be parsed */ }
        });
        return events;
    }
    /**
     * Internal event listener function.
     *
     * This function is bound to contract events and maps the event arguments into a strictly typed payload.
     */
    eventListenerFunc(...args) {
        const ev = args[args.length - 1];
        const type = ev.fragment.name;
        const timestamp = Date.now();
        const payload = {
            type,
            timestamp,
            block: ev.log.blockNumber.toString(),
            tx: ev.log.transactionHash
        };
        if (type === ThriveReviewEventEnum.SubmissionCreated || type === ThriveReviewEventEnum.SubmissionUpdated) {
            payload.submissionId = String(args[0]);
        }
        else if (type === ThriveReviewEventEnum.ReviewCommitted) {
            payload.reviewId = String(args[0]);
            payload.submissionId = String(args[1]);
            payload.reviewer = String(args[2]);
        }
        else if (type === ThriveReviewEventEnum.ReviewCreated) {
            payload.reviewId = String(args[0]);
        }
        else if (type === ThriveReviewEventEnum.SubmissionDecisionReached) {
            payload.submissionId = String(args[0]);
            payload.decision = String(args[1]);
        }
        else if (type === ThriveReviewEventEnum.SubmissionDecisionReachedAsBadge) {
            payload.submissionId = String(args[0]);
            payload.decision = String(args[1]);
            payload.badgeHolder = String(args[2]);
        }
        else if (type === ThriveReviewEventEnum.FailedDistributionFundsClaimed) {
            payload.reviewer = String(args[0]);
            payload.amount = String(args[1]);
        }
        else if (type === ThriveReviewEventEnum.FundsRetrievedByOwner) {
            payload.owner = String(args[0]);
            payload.amount = String(args[1]);
        }
        else if (type === ThriveReviewEventEnum.PendingReviewDeleted) {
            payload.reviewId = String(args[0]);
            payload.reviewer = String(args[1]);
            payload.submissionId = String(args[2]);
        }
        this.eventListener.emit(type, payload);
    }
    /**
     * Subscribe to contract events.
     *
     * @param type - The event name.
     * @param listener - The event listener callback.
     */
    onContractEvent(type, listener) {
        this.eventListener.addListener(type, listener);
        const count = this.eventListenerCount.get(type) || 0;
        if (count === 0 && this.contract) {
            this.contract.on(type, this.eventListenerFunc.bind(this));
        }
        this.eventListenerCount.set(type, count + 1);
    }
    /**
     * Unsubscribe from contract events.
     *
     * @param type - The event name.
     * @param listener - (Optional) Specific listener to remove.
     */
    offContractEvent(type, listener) {
        if (listener) {
            this.eventListener.removeListener(type, listener);
            let count = (this.eventListenerCount.get(type) || 0) - 1;
            if (count <= 0 && this.contract) {
                this.contract.off(type);
                count = 0;
            }
            this.eventListenerCount.set(type, count);
        }
        else {
            this.eventListener.removeAllListeners(type);
            if (this.contract) {
                this.contract.off(type);
            }
            this.eventListenerCount.set(type, 0);
        }
    }
    async createSubmission(submissionMetadata, value) {
        if (!this.wallet)
            throw new ThriveWalletMissingError();
        if (!this.contract)
            throw new ThriveContractNotInitializedError();
        const tx = await this.contract.createSubmission({ submissionMetadata }, { value });
        await tx.wait();
        return tx.hash;
    }
    async updateSubmission(submissionId, submissionMetadata) {
        if (!this.wallet)
            throw new ThriveWalletMissingError();
        if (!this.contract)
            throw new ThriveContractNotInitializedError();
        const tx = await this.contract.updateSubmission(submissionMetadata, submissionId);
        await tx.wait();
        return tx.hash;
    }
    async commitToReview(submissionId) {
        if (!this.wallet)
            throw new ThriveWalletMissingError();
        if (!this.contract)
            throw new ThriveContractNotInitializedError();
        const tx = await this.contract.commitToReview(submissionId);
        await tx.wait();
        return tx.hash;
    }
    async submitReview(reviewId, decision, reviewMetadata) {
        if (!this.wallet)
            throw new ThriveWalletMissingError();
        if (!this.contract)
            throw new ThriveContractNotInitializedError();
        const review = { id: reviewId, decision, reviewMetadata };
        const tx = await this.contract.submitReview(review);
        await tx.wait();
        return tx.hash;
    }
    async deletePendingReview(reviewId) {
        if (!this.wallet)
            throw new ThriveWalletMissingError();
        if (!this.contract)
            throw new ThriveContractNotInitializedError();
        const tx = await this.contract.deletePendingReview(reviewId);
        await tx.wait();
        return tx.hash;
    }
    async deletePendingReviews(reviewIds) {
        if (!this.wallet)
            throw new ThriveWalletMissingError();
        if (!this.contract)
            throw new ThriveContractNotInitializedError();
        const tx = await this.contract.deletePendingReviews(reviewIds);
        await tx.wait();
        return tx.hash;
    }
    async reachDecisionOnSubmissionAsJudge(submissionId, decision, judgeDecisionMetadata) {
        if (!this.wallet)
            throw new ThriveWalletMissingError();
        if (!this.contract)
            throw new ThriveContractNotInitializedError();
        const tx = await this.contract.reachDecisionOnSubmissionAsJudge(submissionId, decision, judgeDecisionMetadata);
        await tx.wait();
        return tx.hash;
    }
    async claimFailedDistributionFunds() {
        if (!this.wallet)
            throw new ThriveWalletMissingError();
        if (!this.contract)
            throw new ThriveContractNotInitializedError();
        const tx = await this.contract.claimFailedDistributionFunds();
        await tx.wait();
        return tx.hash;
    }
    async retrieveFundsByOwner() {
        if (!this.wallet)
            throw new ThriveWalletMissingError();
        if (!this.contract)
            throw new ThriveContractNotInitializedError();
        const tx = await this.contract.retrieveFundsByOwner();
        await tx.wait();
        return tx.hash;
    }
    // -------------------------------
    // DISPUTE FUNCTIONALITY
    // -------------------------------
    async raiseDisputeOnSubmission(submissionId, disputeMetadata) {
        if (!this.wallet)
            throw new ThriveWalletMissingError();
        if (!this.contract)
            throw new ThriveContractNotInitializedError();
        const tx = await this.contract.raiseDisputeOnSubmission(submissionId, disputeMetadata);
        await tx.wait();
        return tx.hash;
    }
    async resolveDisputeOnSubmission(submissionId, decision, disputeResolutionMetadata) {
        if (!this.wallet)
            throw new ThriveWalletMissingError();
        if (!this.contract)
            throw new ThriveContractNotInitializedError();
        const tx = await this.contract.resolveDisputeOnSubmission(submissionId, decision, disputeResolutionMetadata);
        await tx.wait();
        return tx.hash;
    }
    async cancelDisputeOnSubmission(submissionId) {
        if (!this.wallet)
            throw new ThriveWalletMissingError();
        if (!this.contract)
            throw new ThriveContractNotInitializedError();
        const tx = await this.contract.cancelDisputeOnSubmission(submissionId);
        await tx.wait();
        return tx.hash;
    }
    async distributePayoutsForNonDisputedSubmissions(submissionIds) {
        if (!this.wallet)
            throw new ThriveWalletMissingError();
        if (!this.contract)
            throw new ThriveContractNotInitializedError();
        const tx = await this.contract.distributePayoutsForNonDisputedSubmissions(submissionIds);
        await tx.wait();
        return tx.hash;
    }
    async distributePayoutsForNonDisputedSubmission(submissionId) {
        if (!this.wallet)
            throw new ThriveWalletMissingError();
        if (!this.contract)
            throw new ThriveContractNotInitializedError();
        const tx = await this.contract.distributePayoutsForNonDisputedSubmission(submissionId);
        await tx.wait();
        return tx.hash;
    }
    // -------------------------------
    // VIEW FUNCTIONS
    // -------------------------------
    async userHasPendingSubmission(user) {
        if (!this.contract)
            throw new ThriveContractNotInitializedError();
        return await this.contract.userHasPendingSubmission(user);
    }
    async userHasAcceptedSubmission(user) {
        if (!this.contract)
            throw new ThriveContractNotInitializedError();
        return await this.contract.userHasAcceptedSubmission(user);
    }
    async allSubmissionsPaidOut() {
        if (!this.contract)
            throw new ThriveContractNotInitializedError();
        return await this.contract.allSubmissionsPaidOut();
    }
    async getSubmissionDecision(submissionId) {
        if (!this.contract)
            throw new ThriveContractNotInitializedError();
        return await this.contract.getSubmissionDecision(submissionId);
    }
    async getSubmissionStatus(submissionId) {
        if (!this.contract)
            throw new ThriveContractNotInitializedError();
        return await this.contract.getSubmissionStatus(submissionId);
    }
    async hasWorkerUnitContract() {
        if (!this.contract)
            throw new ThriveContractNotInitializedError();
        return await this.contract.hasWorkerUnitContract();
    }
}
