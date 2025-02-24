import { ethers } from 'ethers'
export interface ThriveComplianceStoreOptions {
    wallet?: ethers.Wallet;
    provider?: ethers.Provider;
    address: string;
}
export interface ThriveOraclePrice {
    pair: string;
    price: string;
    updatedAt: number;
    updatedBy: string;
}
export declare class ThriveComplianceStore {
  protected wallet?: ethers.Wallet
  protected provider?: ethers.Provider
  protected contract: ethers.Contract
  constructor(params: ThriveComplianceStoreOptions);
  setWallet(wallet: ethers.Wallet): void;
  getWalletAddress(): string;
  setCheckTypeValidityDuration(checkType: string, duration: number): Promise<string>;
  setComplianceCheck(checkType: string, account: string, passed: boolean): Promise<string>;
  removeComplianceCheck(checkType: string, account: string): Promise<string>;
  passedComplianceCheck(checkType: string, account: string): Promise<boolean>;
}
