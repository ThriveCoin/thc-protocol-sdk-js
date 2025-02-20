import { ethers } from 'ethers'
import { ThriveProtocol } from '../src'

const main = async () => {
  const provider = new ethers.JsonRpcProvider(process.env.RPC!)
  // NOTE! should be contract admin to support setting price
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider)

  const sdk = new ThriveProtocol({
    provider,
    wallet,
    oraclePrice: {
      address: process.env.ORACLE_ADDRESS!
    }
  })

  let res
  res = await sdk.thriveOraclePrice.setPrice('ETH-USD', '3000')
  console.log('lock hash:', res)

  res = await sdk.thriveOraclePrice.getPrice('ETH-USD')
  console.log('price res:', res)
}

main()
