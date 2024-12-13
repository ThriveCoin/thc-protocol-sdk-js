import { ethers } from 'ethers'
import { ThriveBridgeSourceType, ThriveProtocol } from '../src'

const main = async () => {
  const srcProvider = new ethers.JsonRpcProvider(process.env.SRC_RPC!)
  // NOTE! should be contract admin to support unlock tokens
  const srcWallet = new ethers.Wallet(process.env.SRC_PRIVATE_KEY!, srcProvider)

  const destProvider = new ethers.JsonRpcProvider(process.env.DEST_RPC!)
  // NOTE! should be contract admin to support mint tokens
  const destWallet = new ethers.Wallet(process.env.DEST_PRIVATE_KEY!, destProvider)

  const sdk = new ThriveProtocol({
    bridge: {
      sourceWallet: srcWallet,
      sourceProvider: srcProvider,
      sourceAddress: process.env.SRC_BRIDGE!,
      sourceTokenAddress: process.env.SRC_TOKEN!,
      sourceContractType: ThriveBridgeSourceType.IERC20,
      destinationWallet: destWallet,
      destinationProvider: destProvider,
      destinationAddress: process.env.DEST_BRIDGE!,
      destinationTokenAddress: process.env.DEST_TOKEN!
    }
  })

  const srcFromBlock = await srcProvider.getBlockNumber()
  const destFromtBlock = await destProvider.getBlockNumber()

  // Lock tokens on source
  let res = await sdk.thriveBridgeSource.lockTokens({ receiver: srcWallet.address, amount: '1' })
  console.log('lock hash:', res)
  let srcToBlock = (await destProvider.getTransactionReceipt(res))!.blockNumber
  let event = (await sdk.thriveBridgeSource.getBridgeEvents('TokenLocked', srcFromBlock, srcToBlock)).at(-1)
  console.log('lock event:', event)
  if (!event) {
    return
  }

  // Mint tokens on destination
  res = await sdk.thriveBridgeDestination.mintTokens({
    sender: event.sender,
    receiver: event.receiver,
    amountUnit: event.amount,
    nonce: event.nonce,
    signature: event.signature
  })
  console.log('mint hash:', res)
  let destToBlock = (await destProvider.getTransactionReceipt(res))!.blockNumber
  event = (await sdk.thriveBridgeDestination.getBridgeEvents('TokenMinted', destFromtBlock, destToBlock)).at(-1)
  console.log('mint event:', event)
  if (!event) {
    return
  }

  // Burn tokens on destination
  res = await sdk.thriveBridgeDestination.burnTokens({ receiver: destWallet.address, amount: '1' })
  console.log('burn hash:', res)
  destToBlock = (await destProvider.getTransactionReceipt(res))!.blockNumber
  event = (await sdk.thriveBridgeDestination.getBridgeEvents('TokenBurned', destFromtBlock, destToBlock)).at(-1)
  console.log('burn event:', event)
  if (!event) {
    return
  }

  // Unlock tokens on source
  res = await sdk.thriveBridgeSource.unlockTokens({
    sender: event.sender,
    receiver: event.receiver,
    amountUnit: event.amount,
    nonce: event.nonce,
    signature: event.signature
  })
  console.log('unlock hash:', res)
  srcToBlock = (await destProvider.getTransactionReceipt(res))!.blockNumber
  event = (await sdk.thriveBridgeSource.getBridgeEvents('TokenUnlocked', srcFromBlock, srcToBlock)).at(-1)
  console.log('unlock event:', event)
}

main()
