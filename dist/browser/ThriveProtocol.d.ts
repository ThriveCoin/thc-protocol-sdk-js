import { ethers } from 'ethers';
import { ThriveBridgeDestination, ThriveBridgeSource, ThriveBridgeSourceType } from './ThriveBridge';
export interface ThriveProtocolOptions {
    provider?: ethers.Provider;
    wallet?: ethers.Wallet;
    bridge?: {
        sourceWallet?: ethers.Wallet;
        sourceProvider?: ethers.Provider;
        sourceAddress: string;
        sourceTokenAddress?: string;
        sourceContractType: ThriveBridgeSourceType;
        destinationWallet?: ethers.Wallet;
        destinationProvider?: ethers.Provider;
        destinationAddress: string;
        destinationTokenAddress: string;
    };
}
export declare class ThriveProtocol {
    protected provider?: ethers.Provider;
    protected wallet?: ethers.Wallet;
    protected _thriveBridgeSource?: ThriveBridgeSource;
    protected _thriveBridgeDestination?: ThriveBridgeDestination;
    constructor(params: ThriveProtocolOptions);
    get thriveBridgeSource(): ThriveBridgeSource;
    get thriveBridgeDestination(): ThriveBridgeDestination;
}
