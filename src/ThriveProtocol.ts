import { ethers } from 'ethers'
import { ThriveBridgeDestination, ThriveBridgeSource, ThriveBridgeSourceType } from './ThriveBridge'
import { ThriveWorkerUnit } from './ThriveWorkerUnit'
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
  }
}

export class ThriveProtocol {
  protected provider?: ethers.Provider
  protected wallet?: ethers.Wallet
  protected _thriveBridgeSource?: ThriveBridgeSource
  protected _thriveBridgeDestination?: ThriveBridgeDestination
  protected _thriveWorkerUnit?: ThriveWorkerUnit

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
}
