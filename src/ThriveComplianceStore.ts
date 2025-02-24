import { ethers, keccak256 } from 'ethers'

import ThriveComplianceStoreABI from './abis/ThriveComplianceStore.json'
import ThriveProviderMissingError from './errors/ThriveProviderMissingError'
import ThriveWalletMissingError from './errors/ThriveWalletMissingError'

export interface ThriveComplianceStoreOptions {
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

export class ThriveComplianceStore {
  protected wallet?: ethers.Wallet
  protected provider?: ethers.Provider
  protected contract: ethers.Contract

  constructor (params: ThriveComplianceStoreOptions) {
    this.wallet = params.wallet
    this.provider = params.provider

    if (!this.provider && !this.wallet) {
      throw new ThriveProviderMissingError()
    }

    this.contract = new ethers.Contract(params.address, ThriveComplianceStoreABI, this.wallet || this.provider)
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

  public async setCheckTypeValidityDuration (checkType: string, duration: number): Promise<string> {
    if (!this.wallet) {
      throw new ThriveWalletMissingError()
    }

    const tx = await this.contract.setCheckTypeValidityDuration(keccak256(checkType), duration.toString())
    await tx.wait()

    return tx.hash
  }

  public async setComplianceCheck (checkType: string, account: string, passed: boolean): Promise<string> {
    if (!this.wallet) {
      throw new ThriveWalletMissingError()
    }

    const tx = await this.contract.setComplianceCheck(keccak256(checkType), account, passed)
    await tx.wait()

    return tx.hash
  }

  public async removeComplianceCheck (checkType: string, account: string): Promise<string> {
    if (!this.wallet) {
      throw new ThriveWalletMissingError()
    }

    const tx = await this.contract.setComplianceCheck(keccak256(checkType), account)
    await tx.wait()

    return tx.hash
  }

  public async passedComplianceCheck (checkType: string, account: string): Promise<boolean> {
    const res = await this.contract.passedComplianceCheck(keccak256(checkType), account)
    return res
  }
}
