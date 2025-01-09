import { ethers } from 'ethers'
import { ThriveProtocol, ThriveWorkerUnitTokenType } from '../src'

const main = async () => {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL!)
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider)

  const sdk = new ThriveProtocol({
    workerUnit: {
      factoryAddress: process.env.FACTORY_ADDRESS!,
      wallet,
      provider
    }
  })

  const workerUnitOptions = {
    moderator: wallet.address,
    rewardToken: process.env.REWARD_TOKEN,
    tokenType: ThriveWorkerUnitTokenType.NATIVE!,
    rewardAmount: ethers.parseEther('0.1').toString(),
    maxRewards: ethers.parseEther('1').toString(),
    validationRewardAmount: ethers.parseEther('0.01').toString(),
    deadline: (Date.now() + 7 * 24 * 60 * 60 * 1000),
    maxCompletionsPerUser: 2,
    validators: [wallet.address],
    assignedContributor: wallet.address,
    badgeQuery: wallet.address
  }

  const newWorkerUnitAddress = await sdk.thriveWorkerUnit.createNewWorkerUnit(workerUnitOptions)
  console.log('New Worker Unit Address:', newWorkerUnitAddress)

  // Listen for events
  sdk.thriveWorkerUnit.onContractEvent('Initialized', (event) => {
    console.log('Initialized Event:', event)
  })

  sdk.thriveWorkerUnit.onContractEvent('ConfirmationAdded', (event) => {
    console.log('Confirmation Added Event:', event)
  })

  sdk.thriveWorkerUnit.onContractEvent('Withdrawn', (event) => {
    console.log('Withdrawn Event:', event)
  })

  // Start calling the functions
  const initializeTxHash = await sdk.thriveWorkerUnit.initialize(ethers.parseEther('2').toString())
  console.log('Initialize Transaction Hash:', initializeTxHash)

  const confirmTxHash = await sdk.thriveWorkerUnit.confirm(wallet.address, 'exampleValidationMetadata')
  console.log('Confirm Transaction Hash:', confirmTxHash)

  const currentTimeInSeconds = Math.floor(Date.now() / 1000)

  const deadline = currentTimeInSeconds + 60 // deadline current + 1 minute
  const setDeadlineTxHash = await sdk.thriveWorkerUnit.setDeadline(deadline)
  console.log('Set Deadline Hash:', setDeadlineTxHash)

  const waitTimeInMilliseconds = (deadline + 70 - Math.floor(Date.now() / 1000)) * 1000 // wait 1 minute and 10 seconds

  console.log(`Waiting ${waitTimeInMilliseconds / 1000} seconds until calling withdrawRemaining...`)
  setTimeout(async () => {
    try {
      console.log('1 minute and 10 seconds after deadline has passed. Proceeding to withdraw remaining funds...')
      const withdrawTxHash = await sdk.thriveWorkerUnit.withdrawRemaining()
      console.log('Withdraw Transaction Hash:', withdrawTxHash)
    } catch (error) {
      console.error('Error while calling withdrawRemaining:', error)
    }
  }, waitTimeInMilliseconds)
}

main().catch(console.error)
