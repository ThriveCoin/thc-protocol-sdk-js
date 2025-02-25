import { ethers } from 'ethers'
import { ThriveBridgeDestination, ThriveBridgeSource, ThriveBridgeSourceType, ThriveBridgeDestinationType } from './ThriveBridge'
import { ThriveWorkerUnit } from './ThriveWorkerUnit'
import { ThriveStakingType, ThriveStaking } from './ThriveStaking'
import { ThriveOraclePriceStore } from './ThriveOraclePriceStore'
import { ThriveComplianceStore } from './ThriveComplianceStore'
export interface ThriveProtocolOptions {
    provider?: ethers.Provider;
    wallet?: ethers.Wallet;
    bridge?: {
        sourceWallet?: ethers.Wallet;
        sourceProvider?: ethers.Provider;
        sourceAddress: string;
        sourceTokenAddress?: string;
        sourceContractType: ThriveBridgeSourceType;
        destinationContractType: ThriveBridgeDestinationType;
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
    stake?: {
        stakingType: ThriveStakingType;
        nativeAddress: string;
        ierc20Address: string;
        token: string;
        yieldRate: string;
        minStakingAmount: string;
        accessControlEnumerable: string;
        role: string;
    };
    oraclePrice?: {
        wallet?: ethers.Wallet;
        provider?: ethers.Provider;
        address: string;
    };
    compliance?: {
        wallet?: ethers.Wallet;
        provider?: ethers.Provider;
        address: string;
    };
}
export declare class ThriveProtocol {
  protected provider?: ethers.Provider
  protected wallet?: ethers.Wallet
  protected _thriveBridgeSource?: ThriveBridgeSource
  protected _thriveBridgeDestination?: ThriveBridgeDestination
  protected _thriveWorkerUnit?: ThriveWorkerUnit
  protected _thriveStaking?: ThriveStaking
  protected _thriveOraclePrice?: ThriveOraclePriceStore
  protected _compliance?: ThriveComplianceStore
  constructor(params: ThriveProtocolOptions);
  get thriveBridgeSource(): ThriveBridgeSource;
  get thriveBridgeDestination(): ThriveBridgeDestination;
  get thriveWorkerUnit(): ThriveWorkerUnit;
  get thriveStaking(): ThriveStaking;
  get thriveOraclePrice(): ThriveOraclePriceStore;
  get compliance(): ThriveComplianceStore;
}
