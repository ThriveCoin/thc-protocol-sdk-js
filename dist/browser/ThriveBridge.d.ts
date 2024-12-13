import { ethers } from 'ethers';
type BlockRange = string | number | bigint;
export declare enum ThriveBridgeSourceType {
    IERC20 = "IERC20",
    NATIVE = "NATIVE"
}
export interface ThriveBridgeEvent {
    sender: string;
    receiver: string;
    amount: string;
    timestamp: number;
    nonce: string;
    signature: string;
    block: string;
    tx: string;
}
export interface ThriveBridgeOptions {
    wallet?: ethers.Wallet;
    provider?: ethers.Provider;
    sourceAddress: string;
    destinationAddress: string;
    tokenAddress?: string;
}
export declare abstract class ThriveBridge {
    protected wallet?: ethers.Wallet;
    protected provider?: ethers.Provider;
    protected sourceAddress: string;
    protected destinationAddress: string;
    protected tokenAddress?: string;
    protected tokenContract?: ethers.Contract;
    protected tokenDecimals?: number;
    protected bridgeContract: ethers.Contract;
    protected eventInterface: ethers.Interface;
    constructor(params: ThriveBridgeOptions);
    protected prepareSignature(contract: string, sender: string, receiver: string, amount: string, nonce: string): Promise<string>;
    protected getTokenDecimals(): Promise<number>;
    setWallet(wallet: ethers.Wallet): void;
    getWallet(): string;
    getBridgeEvents(type: string, from: BlockRange, to: BlockRange): Promise<ThriveBridgeEvent[]>;
}
export declare class ThriveBridgeSource extends ThriveBridge {
    protected contractType: ThriveBridgeSourceType;
    constructor(params: ThriveBridgeOptions & {
        sourceContractType: ThriveBridgeSourceType;
    });
    protected getTokenDecimals(): Promise<number>;
    lockTokens(params: {
        receiver: string;
        amountUnit?: string;
        amount?: string;
    }): Promise<string>;
    unlockTokens(params: {
        sender: string;
        receiver: string;
        amountUnit?: string;
        amount?: string;
        nonce: string;
        signature: string;
    }): Promise<string>;
    getBridgeEvents(type: 'TokenLocked' | 'TokenUnlocked', from: BlockRange, to: BlockRange): Promise<ThriveBridgeEvent[]>;
}
export declare class ThriveBridgeDestination extends ThriveBridge {
    constructor(params: ThriveBridgeOptions & {
        tokenAddress: string;
    });
    mintTokens(params: {
        sender: string;
        receiver: string;
        amountUnit?: string;
        amount?: string;
        nonce: string;
        signature: string;
    }): Promise<string>;
    burnTokens(params: {
        receiver: string;
        amountUnit?: string;
        amount?: string;
    }): Promise<string>;
    getBridgeEvents(type: 'TokenMinted' | 'TokenBurned', from: BlockRange, to: BlockRange): Promise<ThriveBridgeEvent[]>;
}
export {};
