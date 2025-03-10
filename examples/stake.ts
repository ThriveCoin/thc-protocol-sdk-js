import { ethers } from 'ethers'
import { ThriveProtocol, ThriveStakingType } from '../src'

const main = async () => {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL!)
  const wallet = new ethers.Wallet(process.env.TEST_PRIVATE_KEY!, provider)

  const sdk = new ThriveProtocol({
    wallet,
    provider,
    stake: {
      stakingType: ThriveStakingType.NATIVE,
      nativeAddress: process.env.NATIVE_STAKING_ADDRESS!,
      ierc20Address: process.env.IERC20_STAKING_ADDRESS!,
      token: ethers.ZeroAddress,
      yieldRate: '3858024691358',
      minStakingAmount: ethers.parseEther('0.1').toString(),
      accessControlEnumerable: process.env.ACCESS_CONTROL_ADDRESS!,
      role: process.env.ADMIN_ROLE!
    }
  })

  sdk.thriveStaking.onContractEvent('Staked', (event) => {
    console.log('Staked event detected:', event)
  })

  sdk.thriveStaking.onContractEvent('YieldClaimed', (event) => {
    console.log('Yield Claimed:', event)
  })

  sdk.thriveStaking.onContractEvent('Withdrawn', (event) => {
    console.log('Withdrawn:', event)
  })

  console.log('Staking 2 ETH...')
  const stakeTxHash = await sdk.thriveStaking.stake(ethers.parseEther('2').toString())
  console.log('Stake Transaction Hash:', stakeTxHash)

  console.log('Calculating yield earned immediately after staking...')
  const yieldEarned = await sdk.thriveStaking.calculateYield()
  console.log('Claimable Yield (in wei):', yieldEarned.claimableYield)
  console.log('Ongoing Yield (in wei):', yieldEarned.ongoingYield)
  console.log('Claimable Yield (in Thrive):', ethers.formatEther(yieldEarned.claimableYield))
  console.log('Ongoing Yield Earned (in Thrive):', ethers.formatEther(yieldEarned.ongoingYield))

  setTimeout(async () => {
    try {
      const yieldAfterOneMinute = await sdk.thriveStaking.calculateYield()
      console.log('Yield after 1 minute (in wei):', yieldAfterOneMinute.ongoingYield)
      console.log('Yield after 1 minute (in Thrive):', ethers.formatEther(yieldAfterOneMinute.ongoingYield))
    } catch (error) {
      console.error('Error calculating yield after 1 minute:', error)
    }
  }, 60000)

  setTimeout(async () => {
    try {
      const yieldAfterTwoMinutes = await sdk.thriveStaking.calculateYield()
      console.log('Yield after 2 minutes (in wei):', yieldAfterTwoMinutes)
      console.log('Yield after 2 minutes (in Thrive):', ethers.formatEther(yieldAfterTwoMinutes.ongoingYield))

      console.log('Claiming yield...')
      const claimTxHash = await sdk.thriveStaking.claimYield()
      console.log('Claim Yield Transaction Hash:', claimTxHash)

      const yieldAfterClaim = await sdk.thriveStaking.calculateYield()
      console.log('Yield after claiming (in wei):', yieldAfterClaim)
      console.log('Yield after claiming (in Thrive):', ethers.formatEther(yieldAfterClaim.ongoingYield))
    } catch (error) {
      console.error('Error calculating yield after 2 minutes:', error)
    }
  }, 120000)
}

main().catch(console.error)
