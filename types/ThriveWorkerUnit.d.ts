import { ethers } from 'ethers'
import { EventEmitter } from 'events'
export declare enum ThriveWorkerUnitTokenType {
    IERC20 = 'IERC20',
    NATIVE = 'NATIVE'
}
export declare enum ThriveWorkerUnitEventEnum {
    'Withdrawn' = 'Withdrawn',
    'Initialized' = 'Initialized',
    'ConfirmationAdded' = 'ConfirmationAdded'
}
export type ThriveWorkerUnitEventKey = 'Withdrawn' | 'Initialized' | 'ConfirmationAdded';
export interface ThriveWorkerUnitEvent {
    type: ThriveWorkerUnitEventKey;
    contributor: string;
    validationMetadata: string;
    rewardAmount: string;
    validator: string;
    token: string;
    amount: string;
    timestamp: number;
    block?: string;
    tx?: string;
}
export type ThriveWorkerUnitEventListener = (event: ThriveWorkerUnitEvent) => void;
export interface ThriveWorkerUnitOptions {
    wallet?: ethers.Wallet;
    provider?: ethers.Provider;
    contractAddress: string;
    factoryAddress?: string;
}
export declare class ThriveWorkerUnit {
  protected wallet?: ethers.Wallet
  protected provider?: ethers.Provider
  protected contractAddress: string
  protected factoryAddress?: string
  protected contract: ethers.Contract
  protected factoryContract?: ethers.Contract
  protected eventInterface: ethers.Interface
  protected eventListener: EventEmitter<Record<ThriveWorkerUnitEventKey, [event: ThriveWorkerUnitEvent]>>
  protected eventListenerCount: Map<ThriveWorkerUnitEventKey, number>
  constructor(params: ThriveWorkerUnitOptions);
  protected prepareSignature(contract: string, sender: string, receiver: string, amount: string, nonce: string): Promise<string>;
  setWallet(wallet: ethers.Wallet): void;
  getWallet(): string;
  createNewWorkerUnit(...args: ThriveWorkerUnitOptions[]): Promise<string>;
  getContractEventsFromHash(hash: string): Promise<ThriveWorkerUnitEvent[]>;
  protected eventListenerFunc(contributor: string, validationMetadata: string, rewardAmount: bigint, validator: string, ev: ethers.ContractEventPayload): void;
  onContractEvent(type: ThriveWorkerUnitEventKey, listener: ThriveWorkerUnitEventListener): void;
  offContractEvent(type: ThriveWorkerUnitEventKey, listener?: ThriveWorkerUnitEventListener): void;
}
