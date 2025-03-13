import { ethers } from 'ethers'
import { ThriveProtocol, ThriveProtocolOptions } from '../src/ThriveProtocol'
import { ThriveReviewOptions } from '../src/ThriveReview'
import { ThriveWorkerUnitTokenType, ThriveWorkerUnitOptions } from '../src/ThriveWorkerUnit'

async function main () {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL!)
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider)

  const protocolOptions: ThriveProtocolOptions = {
    provider,
    wallet,
    review: {
      factoryAddress: process.env.REVIEW_FACTORY_ADDRESS!,
      wallet,
      provider
      // Note: We do not pass a contractAddress here, because we will create it via the factory.
    }
  }

  const sdk = new ThriveProtocol(protocolOptions)

  const workerUnitArgs: ThriveWorkerUnitOptions = {
    moderator: wallet.address,
    rewardToken: ethers.ZeroAddress,
    tokenType: ThriveWorkerUnitTokenType.NATIVE,
    rewardAmount: ethers.parseEther('0.1').toString(),
    maxRewards: ethers.parseEther('1').toString(),
    validationRewardAmount: ethers.parseEther('0.1').toString(),
    deadline: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days from now
    validationMetadata: 'validation metadata test',
    metadataVersion: '1.0',
    metadata: 'metadata test',
    maxCompletionsPerUser: 1,
    validators: [], // The factory function will override this with the new review contract as sole validator
    assignedContributor: ethers.ZeroAddress,
    badgeQuery: wallet.address
  }

  const reviewConfiguration: ThriveReviewOptions = {
    workUnit: ethers.ZeroAddress, // This will be replaced by the new Worker Unit address on-chain
    reviewerRewardsTotalAllocation: '0',
    reviewerReward: '0',
    agreementThreshold: 6000, // e.g. 60%
    maximumSubmissionsPerUser: 3,
    minimumReviews: 1,
    maximumSubmissions: 10,
    maximumReviewsPerSubmission: 3,
    submissionDeadline: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
    reviewCommitmentPeriod: 5 * 24 * 60 * 60, // 1 day
    reviewDeadlinePeriod: 10 * 24 * 60 * 60, // 3 days
    submitterBadges: [],
    reviewerBadges: [],
    judgeBadges: [],
    disputeResolverBadges: [],
    reviewMetadata: 'review test',
    submissionMetadata: 'submission test'
  }

  //    We pass 'value' to fund both the worker unit's rewards & the reviewer rewards.
  //    The factory method will split the funds accordingly:
  //      - workerUnit => workUnitAllocation
  //      - review => reviewContractAllocation
  const totalValue = ethers.parseEther('2').toString() // e.g. 2 ETH for both
  const { reviewContract, workUnitContract } =
    await sdk.thriveReview.createWorkUnitAndReviewContract(
      workerUnitArgs,
      reviewConfiguration,
      wallet.address, // The owner of the newly created Review contract
      totalValue
    )

  console.log('Worker Unit Contract Address:', workUnitContract)
  console.log('Review Contract Address:', reviewContract)

  const protocolWithNewReview = new ThriveProtocol({
    provider,
    wallet,
    review: {
      factoryAddress: process.env.REVIEW_FACTORY_ADDRESS!,
      wallet,
      provider,
      contractAddress: reviewContract
    }
  })

  console.log('--- Creating a Submission ---')
  const submissionTxHash = await protocolWithNewReview.thriveReview.createSubmission(
    'ipfs://submissionMetadata',
    ethers.parseEther('0.05').toString()
  )
  console.log('Submission Tx Hash:', submissionTxHash)

  console.log('--- Updating Submission ---')
  const updateTxHash = await protocolWithNewReview.thriveReview.updateSubmission(
    BigInt(0), // submission id
    'ipfs://updatedSubmissionMetadata'
  )
  console.log('Update Submission Tx Hash:', updateTxHash)

  console.log('--- Committing to Review ---')
  const commitTxHash = await protocolWithNewReview.thriveReview.commitToReview(BigInt(0))
  console.log('Commit Tx Hash:', commitTxHash)

  console.log('--- Submitting a Review ---')
  const reviewTxHash = await protocolWithNewReview.thriveReview.submitReview(
    BigInt(0), // review id
    0, // decision (e.g., 0 for ACCEPTED)
    'ipfs://reviewMetadata'
  )
  console.log('Review Submission Tx Hash:', reviewTxHash)

  console.log('--- Deleting Pending Review ---')
  const deletePendingReviewTxHash = await protocolWithNewReview.thriveReview.deletePendingReview(0)
  console.log('Delete Pending Review Tx Hash:', deletePendingReviewTxHash)

  console.log('--- Deleting Multiple Pending Reviews ---')
  const deletePendingReviewsTxHash = await protocolWithNewReview.thriveReview.deletePendingReviews([1, 2])
  console.log('Delete Pending Reviews Tx Hash:', deletePendingReviewsTxHash)

  console.log('--- Reaching Decision as Judge ---')
  const judgeDecisionTxHash = await protocolWithNewReview.thriveReview.reachDecisionOnSubmissionAsJudge(
    0,
    0, // decision (e.g., 0 for ACCEPTED or REJECTED as per enum)
    'ipfs://judgeDecisionMetadata'
  )
  console.log('Judge Decision Tx Hash:', judgeDecisionTxHash)

  console.log('--- Claiming Failed Distribution Funds ---')
  const claimFundsTxHash = await protocolWithNewReview.thriveReview.claimFailedDistributionFunds()
  console.log('Claim Failed Distribution Funds Tx Hash:', claimFundsTxHash)

  console.log('--- Retrieving Funds by Owner ---')
  const retrieveFundsTxHash = await protocolWithNewReview.thriveReview.retrieveFundsByOwner()
  console.log('Retrieve Funds Tx Hash:', retrieveFundsTxHash)

  console.log('--- Raising Dispute on Submission ---')
  const raiseDisputeTxHash = await protocolWithNewReview.thriveReview.raiseDisputeOnSubmission(
    0,
    'ipfs://disputeMetadata'
  )
  console.log('Raise Dispute Tx Hash:', raiseDisputeTxHash)

  console.log('--- Resolving Dispute on Submission ---')
  const resolveDisputeTxHash = await protocolWithNewReview.thriveReview.resolveDisputeOnSubmission(
    0,
    0, // decision (e.g., 0 for ACCEPTED or REJECTED)
    'ipfs://disputeResolutionMetadata'
  )
  console.log('Resolve Dispute Tx Hash:', resolveDisputeTxHash)

  console.log('--- Canceling Dispute on Submission ---')
  const cancelDisputeTxHash = await protocolWithNewReview.thriveReview.cancelDisputeOnSubmission(0)
  console.log('Cancel Dispute Tx Hash:', cancelDisputeTxHash)

  console.log('--- Distributing Payouts for Non‑Disputed Submissions ---')
  const distributePayoutsTxHash = await protocolWithNewReview.thriveReview.distributePayoutsForNonDisputedSubmissions([0])
  console.log('Distribute Payouts Tx Hash:', distributePayoutsTxHash)

  console.log('--- Distributing Payout for a Single Non‑Disputed Submission ---')
  const distributeSinglePayoutTxHash = await protocolWithNewReview.thriveReview.distributePayoutsForNonDisputedSubmission(0)
  console.log('Distribute Single Payout Tx Hash:', distributeSinglePayoutTxHash)
}

main().catch(console.error)
