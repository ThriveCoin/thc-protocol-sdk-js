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
    validationMetadata: 'validationMetadataTest',
    metadataVersion: 'metadataVersion - 1.0',
    metadata: 'metadataTest',
    maxCompletionsPerUser: 2,
    validators: [wallet.address, '0xCcb975a08d189bF86f0B1A0B2CB9ba49b9255D7a'],
    assignedContributor: '0x0000000000000000000000000000000000000000',
    badgeQuery: wallet.address
  }

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

  const newWorkerUnitAddress = await sdk.thriveWorkerUnit.createNewWorkerUnit(workerUnitOptions)
  console.log('New Worker Unit Address:', newWorkerUnitAddress)

  const confirmTxHash = await sdk.thriveWorkerUnit.confirm(wallet.address, 'exampleValidationMetadata')
  console.log('Confirm Transaction Hash:', confirmTxHash)

  const latestBlock = await provider.getBlock('latest')
  const currentBlockTime = latestBlock?.timestamp || Math.floor(Date.now() / 1000)

  const deadline = currentBlockTime + 35
  const setDeadlineTxHash = await sdk.thriveWorkerUnit.setDeadline(deadline)
  console.log('Set Deadline Hash:', setDeadlineTxHash)

  const waitTimeInMilliseconds = (deadline - Math.floor(Date.now() / 1000)) * 1000

  console.log(`Waiting ${waitTimeInMilliseconds / 1000} seconds until calling withdrawRemaining...`)
  setTimeout(async () => {
    try {
      console.log(`${waitTimeInMilliseconds / 1000} seconds after deadline has passed. Proceeding to withdraw remaining funds...'`)
      const withdrawTxHash = await sdk.thriveWorkerUnit.withdrawRemaining()
      console.log('Withdraw Transaction Hash:', withdrawTxHash)
    } catch (error) {
      console.error('Error while calling withdrawRemaining:', error)
    }
  }, waitTimeInMilliseconds)
}

main().catch(console.error)
