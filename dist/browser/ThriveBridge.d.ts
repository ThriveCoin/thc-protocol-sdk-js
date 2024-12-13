import { ethers } from 'ethers';
import { EventEmitter } from 'events';
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
export declare enum ThriveBridgeEventEnum {
    'TokenLocked' = "TokenLocked",
    'TokenUnlocked' = "TokenUnlocked",
    'TokenMinted' = "TokenMinted",
    'TokenBurned' = "TokenBurned"
}
export type ThriveBridgeEventKey = 'TokenLocked' | 'TokenUnlocked' | 'TokenMinted' | 'TokenBurned';
export type ThriveBridgeSourceEventKey = 'TokenLocked' | 'TokenUnlocked';
export type ThriveBridgeDestinationEventKey = 'TokenMinted' | 'TokenBurned';
export type ThriveBridgeEventListener = (event: ThriveBridgeEvent) => void;
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
    protected eventListener: EventEmitter<Record<ThriveBridgeEventKey, [event: ThriveBridgeEvent]>>;
    protected eventListenerCount: Map<ThriveBridgeEventKey, number>;
    constructor(params: ThriveBridgeOptions);
    protected prepareSignature(contract: string, sender: string, receiver: string, amount: string, nonce: string): Promise<string>;
    protected getTokenDecimals(): Promise<number>;
    setWallet(wallet: ethers.Wallet): void;
    getWallet(): string;
    getBridgeEvents(type: ThriveBridgeEventKey, from: BlockRange, to: BlockRange): Promise<ThriveBridgeEvent[]>;
    protected eventListenerFunc(sender: string, receiver: string, amount: bigint, timestamp: bigint, nonce: bigint, signature: string, ev: ethers.ContractEventPayload): void;
    onBridgeEvent(type: ThriveBridgeEventKey, listener: ThriveBridgeEventListener): void;
    offBridgeEvent(type: ThriveBridgeEventKey, listener?: ThriveBridgeEventListener): void;
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
    getBridgeEvents(type: ThriveBridgeSourceEventKey, from: BlockRange, to: BlockRange): Promise<ThriveBridgeEvent[]>;
    onBridgeEvent(type: ThriveBridgeSourceEventKey, listener: ThriveBridgeEventListener): void;
    offBridgeEvent(type: ThriveBridgeSourceEventKey, listener?: ThriveBridgeEventListener): void;
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
    getBridgeEvents(type: ThriveBridgeDestinationEventKey, from: BlockRange, to: BlockRange): Promise<ThriveBridgeEvent[]>;
    onBridgeEvent(type: ThriveBridgeDestinationEventKey, listener: ThriveBridgeEventListener): void;
    offBridgeEvent(type: ThriveBridgeDestinationEventKey, listener?: ThriveBridgeEventListener): void;
}
export {};
