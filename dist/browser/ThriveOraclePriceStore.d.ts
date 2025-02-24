import { ethers } from 'ethers';
export interface ThriveOraclePriceStoreOptions {
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
export declare class ThriveOraclePriceStore {
    protected wallet?: ethers.Wallet;
    protected provider?: ethers.Provider;
    protected contract: ethers.Contract;
    constructor(params: ThriveOraclePriceStoreOptions);
    setWallet(wallet: ethers.Wallet): void;
    getWalletAddress(): string;
    setPrice(pair: string, price: string): Promise<string>;
    getPrice(pair: string): Promise<ThriveOraclePrice>;
    decimals(): Promise<number>;
}
