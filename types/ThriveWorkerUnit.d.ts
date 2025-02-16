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
    moderator: string;
    rewardToken?: string;
    tokenType: ThriveWorkerUnitTokenType;
    rewardAmount: string;
    maxRewards: string;
    validationRewardAmount?: string;
    deadline: number;
    maxCompletionsPerUser: number;
    validators: Array<string>;
    assignedContributor: string;
    badgeQuery: string;
}
export declare class ThriveWorkerUnit {
  protected wallet?: ethers.Wallet
  protected provider?: ethers.Provider
  protected contractAddress?: string
  protected factoryAddress: string
  protected contract?: ethers.Contract
  protected factoryContract: ethers.Contract
  protected eventInterface: ethers.Interface
  protected eventListener: EventEmitter<Record<ThriveWorkerUnitEventKey, [event: ThriveWorkerUnitEvent]>>
  protected eventListenerCount: Map<ThriveWorkerUnitEventKey, number>
  constructor(_factoryAddress: string, _wallet: ethers.Wallet, _provider: ethers.Provider, _contractAddress?: string);
  setWallet(wallet: ethers.Wallet): void;
  getWallet(): string;
  createNewWorkerUnit(workerUnitOptions: ThriveWorkerUnitOptions, value: string): Promise<string>;
  getContractEventsFromHash(hash: string): Promise<ThriveWorkerUnitEvent[]>;
  protected eventListenerFunc(contributor: string, validationMetadata: string, rewardAmount: bigint, validator: string, ev: ethers.ContractEventPayload): void;
  onContractEvent(type: ThriveWorkerUnitEventKey, listener: ThriveWorkerUnitEventListener): void;
  offContractEvent(type: ThriveWorkerUnitEventKey, listener?: ThriveWorkerUnitEventListener): void;
  initialize(value: string): Promise<string>;
  confirm(contributor: string, inputValidationMetadata: string): Promise<string>;
  setAssignedContributor(contributor: string): Promise<string>;
  addRequiredBadge(badge: string): Promise<string>;
  removeRequiredBadge(badge: string): Promise<string>;
  setMetadata(metadata: string, metadataVersion: string): Promise<string>;
  setDeadline(deadline: number): Promise<string>;
  withdrawRemaining(): Promise<string>;
  getValidators(): Promise<string[]>;
  getRequiredBadges(): Promise<string[]>;
  status(): Promise<string>;
}
