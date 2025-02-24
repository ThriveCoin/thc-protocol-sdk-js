import { ethers } from 'ethers'

import ThriveOraclePriceStoreABI from './abis/ThriveOraclePriceStore.json'
import ThriveProviderMissingError from './errors/ThriveProviderMissingError'
import ThriveWalletMissingError from './errors/ThriveWalletMissingError'

export interface ThriveOraclePriceStoreOptions {
  wallet?: ethers.Wallet
  provider?: ethers.Provider
  address: string
}

export interface ThriveOraclePrice {
  pair: string,
  price: string,
  updatedAt: number,
  updatedBy: string
}

export class ThriveOraclePriceStore {
  protected wallet?: ethers.Wallet
  protected provider?: ethers.Provider
  protected contract: ethers.Contract

  constructor (params: ThriveOraclePriceStoreOptions) {
    this.wallet = params.wallet
    this.provider = params.provider

    if (!this.provider && !this.wallet) {
      throw new ThriveProviderMissingError()
    }

    this.contract = new ethers.Contract(params.address, ThriveOraclePriceStoreABI, this.wallet || this.provider)
  }

  public setWallet (wallet: ethers.Wallet) {
    this.wallet = wallet
    if (this.contract) {
      this.contract = this.contract.connect(wallet) as ethers.Contract
    }
  }

  public getWalletAddress (): string {
    if (!this.wallet) {
      throw new ThriveWalletMissingError()
    }
    return this.wallet.address
  }

  public async setPrice (pair: string, price: string): Promise<string> {
    if (!this.wallet) {
      throw new ThriveWalletMissingError()
    }

    const tx = await this.contract.setPrice(pair, price)
    await tx.wait()

    return tx.hash
  }

  public async getPrice (pair: string): Promise<ThriveOraclePrice> {
    const res = await this.contract.getPrice(pair)
    return {
      pair,
      price: res[0].toString(),
      updatedAt: Number(res[1]) * 1000,
      updatedBy: res[2].toString()
    }
  }

  public async decimals (): Promise<string> {
    const res = await this.contract.decimals()
    return res.toString()
  }
}
