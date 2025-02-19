import { ethers } from 'ethers'
import { EventEmitter } from 'events'
export declare enum ThriveStakingType {
    IERC20 = 'IERC20',
    NATIVE = 'NATIVE'
}
export declare enum ThriveStakingEventEnum {
    Staked = 'Staked',
    Withdrawn = 'Withdrawn',
    YieldClaimed = 'YieldClaimed'
}
export type ThriveStakingEventKey = keyof typeof ThriveStakingEventEnum;
export interface ThriveStakingEvent {
    fragment: ethers.EventFragment;
    log: ethers.EventLog;
    type: ThriveStakingEventKey;
    user: string;
    amount: string;
    yield: string;
    timestamp: number;
    block?: string;
    tx?: string;
}
export type ThriveStakingEventListener = (event: ThriveStakingEvent) => void;
export interface ThriveStakingOptions {
    wallet?: ethers.Wallet;
    provider?: ethers.Provider;
    nativeAddress: string;
    ierc20Address: string;
    token: string;
    yieldRate: string;
    minStakingAmount: string;
    accessControlEnumerable: string;
    role: string;
}
export declare class ThriveStaking {
  protected wallet?: ethers.Wallet
  protected provider?: ethers.Provider
  protected nativeAddress: string
  protected ierc20Address: string
  protected token: string
  protected contract?: ethers.Contract
  protected stakingType: ThriveStakingType
  protected eventInterface: ethers.Interface
  protected eventListener: EventEmitter
  protected eventListenerCount: Map<'Withdrawn' | 'Staked' | 'YieldClaimed', number>
  constructor(params: ThriveStakingOptions, stakingType?: ThriveStakingType);
  private initContract
  setWallet(wallet: ethers.Wallet): void;
  getWalletAddress(): string;
  switchStakingType(stakingType: ThriveStakingType): void;
  protected eventListenerFunc(...args: ThriveStakingEvent[]): void;
  onContractEvent(type: ThriveStakingEventKey, listener: ThriveStakingEventListener): void;
  offEvent(eventType: ThriveStakingEventKey, listener?: ThriveStakingEventListener): void;
  stake(amount: string): Promise<string>;
  withdraw(): Promise<string>;
  claimYield(): Promise<string>;
  calculateYield(address?: string): Promise<string>;
  setYieldRate(newYieldRate: string): Promise<string>;
  setMinStakingAmount(newMin: string): Promise<string>;
}
