import { ethers } from 'ethers'
import { ThriveBridgeDestination, ThriveBridgeSource, ThriveBridgeSourceType } from './ThriveBridge'
import { ThriveWorkerUnit } from './ThriveWorkerUnit'
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
    workerUnit?: {
        factoryAddress: string;
        wallet: ethers.Wallet;
        provider: ethers.Provider;
        contractAddress?: string;
    };
}
export declare class ThriveProtocol {
  protected provider?: ethers.Provider
  protected wallet?: ethers.Wallet
  protected _thriveBridgeSource?: ThriveBridgeSource
  protected _thriveBridgeDestination?: ThriveBridgeDestination
  protected _thriveWorkerUnit?: ThriveWorkerUnit
  constructor(params: ThriveProtocolOptions);
  get thriveBridgeSource(): ThriveBridgeSource;
  get thriveBridgeDestination(): ThriveBridgeDestination;
  get thriveWorkerUnit(): ThriveWorkerUnit;
}
