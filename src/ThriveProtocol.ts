import { ethers } from 'ethers'
import { ThriveBridgeDestination, ThriveBridgeSource, ThriveBridgeSourceType } from './ThriveBridge'
import { ThriveWorkerUnit } from './ThriveWorkerUnit'
import { ThriveStakingType, ThriveStaking } from './ThriveStaking'
import { ThriveOraclePriceStore } from './ThriveOraclePriceStore'
import ThriveFeatureNotInitializedError from './errors/ThriveFeatureNotInitializedError'

export interface ThriveProtocolOptions {
  provider?: ethers.Provider,
  wallet?: ethers.Wallet
  bridge?: {
    sourceWallet?: ethers.Wallet,
    sourceProvider?: ethers.Provider,
    sourceAddress: string;
    sourceTokenAddress?: string;
    sourceContractType: ThriveBridgeSourceType,
    destinationWallet?: ethers.Wallet,
    destinationProvider?: ethers.Provider,
    destinationAddress: string;
    destinationTokenAddress: string;
  },
  workerUnit?: {
    factoryAddress: string,
    wallet: ethers.Wallet,
    provider: ethers.Provider,
    contractAddress?: string
  },
  stake?: {
    stakingType: ThriveStakingType,
    nativeAddress: string
    ierc20Address: string
    token: string
    yieldRate: string
    minStakingAmount: string
    accessControlEnumerable: string
    role: string
  },
  oraclePrice?: {
    wallet?: ethers.Wallet,
    provider?: ethers.Provider,
    address: string
  }
}

export class ThriveProtocol {
  protected provider?: ethers.Provider
  protected wallet?: ethers.Wallet
  protected _thriveBridgeSource?: ThriveBridgeSource
  protected _thriveBridgeDestination?: ThriveBridgeDestination
  protected _thriveWorkerUnit?: ThriveWorkerUnit
  protected _thriveStaking?: ThriveStaking
  protected _thriveOraclePrice?: ThriveOraclePriceStore

  constructor (params: ThriveProtocolOptions) {
    this.provider = params.provider
    this.wallet = params.wallet

    if (params.bridge) {
      this._thriveBridgeSource = new ThriveBridgeSource({
        provider: params.bridge.sourceProvider ?? params.provider,
        wallet: params.bridge.sourceWallet ?? params.wallet,
        sourceAddress: params.bridge.sourceAddress,
        sourceContractType: params.bridge.sourceContractType,
        destinationAddress: params.bridge.destinationAddress,
        tokenAddress: params.bridge.sourceTokenAddress
      })
      this._thriveBridgeDestination = new ThriveBridgeDestination({
        provider: params.bridge.destinationProvider ?? params.provider,
        wallet: params.bridge.destinationWallet ?? params.wallet,
        sourceAddress: params.bridge.sourceAddress,
        destinationAddress: params.bridge.destinationAddress,
        tokenAddress: params.bridge.destinationTokenAddress
      })
    }

    if (params.workerUnit) {
      this._thriveWorkerUnit = new ThriveWorkerUnit(
        params.workerUnit.factoryAddress,
        params.workerUnit.wallet ?? params.wallet,
        params.workerUnit.provider ?? params.provider,
        params.workerUnit.contractAddress
      )
    }

    if (params.stake) {
      this._thriveStaking = new ThriveStaking(
        {
          wallet: this.wallet,
          provider: this.provider,
          nativeAddress: params.stake.nativeAddress,
          ierc20Address: params.stake.ierc20Address,
          token: params.stake.token,
          yieldRate: params.stake.yieldRate,
          minStakingAmount: params.stake.minStakingAmount,
          accessControlEnumerable: params.stake.accessControlEnumerable,
          role: params.stake.role
        },
        params.stake.stakingType
      )
    }

    if (params.oraclePrice) {
      this._thriveOraclePrice = new ThriveOraclePriceStore({
        wallet: params.oraclePrice.wallet ?? this.wallet,
        provider: params.oraclePrice.provider ?? this.provider,
        address: params.oraclePrice.address
      })
    }
  }

  get thriveBridgeSource (): ThriveBridgeSource {
    if (!this._thriveBridgeSource) {
      throw new ThriveFeatureNotInitializedError()
    }
    return this._thriveBridgeSource
  }

  get thriveBridgeDestination (): ThriveBridgeDestination {
    if (!this._thriveBridgeDestination) {
      throw new ThriveFeatureNotInitializedError()
    }
    return this._thriveBridgeDestination
  }

  get thriveWorkerUnit (): ThriveWorkerUnit {
    if (!this._thriveWorkerUnit) {
      throw new ThriveFeatureNotInitializedError()
    }
    return this._thriveWorkerUnit
  }

  get thriveStaking (): ThriveStaking {
    if (!this._thriveStaking) {
      throw new ThriveFeatureNotInitializedError()
    }
    return this._thriveStaking
  }

  get thriveOraclePrice (): ThriveOraclePriceStore {
    if (!this._thriveOraclePrice) {
      throw new ThriveFeatureNotInitializedError()
    }
    return this._thriveOraclePrice
  }
}
