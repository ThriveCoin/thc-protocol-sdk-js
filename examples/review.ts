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
    validationRewardAmount: ethers.parseEther('0.01').toString(),
    deadline: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days from now
    maxCompletionsPerUser: 2,
    validators: [], // The factory function will override this with the new review contract as sole validator
    assignedContributor: ethers.ZeroAddress,
    badgeQuery: wallet.address
  }

  const reviewConfiguration: ThriveReviewOptions = {
    workUnit: ethers.ZeroAddress, // This will be replaced by the new Worker Unit address on-chain
    maximumSubmissions: 10,
    maximumSubmissionsPerUser: 2,
    submissionDeadline: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
    reviewDeadlinePeriod: 3 * 24 * 60 * 60, // 3 days
    reviewCommitmentPeriod: 1 * 24 * 60 * 60, // 1 day
    minimumReviews: 1,
    maximumReviewsPerSubmission: 3,
    agreementThreshold: 6000, // e.g. 60%
    reviewerReward: ethers.parseEther('0.01').toString(),
    reviewerRewardsTotalAllocation: ethers.parseEther('1').toString(),
    judgeBadges: [],
    reviewerBadges: [],
    submitterBadges: []
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

  // ─────────────────────────────────────────────────────────────────────────────
  // RE-INSTANTIATE THE PROTOCOL FOR THE NEW REVIEW CONTRACT
  // ─────────────────────────────────────────────────────────────────────────────
  // Since the newly created review contract address is known, we can create a
  // new ThriveProtocol instance pointing to it for further operations (submissions, reviews, etc.)

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
  console.log('Submission Tx:', submissionTxHash)

  console.log('--- Committing to Review ---')
  const commitTxHash = await protocolWithNewReview.thriveReview.commitToReview(0)
  console.log('Commit Tx:', commitTxHash)

  console.log('--- Submitting the Review ---')
  const reviewTxHash = await protocolWithNewReview.thriveReview.submitReview(
    0, // reviewId
    0, // 0 => ACCEPTED
    'ipfs://reviewMetadata'
  )
  console.log('Review Tx:', reviewTxHash)

  // TODO: disputes, payouts, etc. as normal
}

main().catch(console.error)
