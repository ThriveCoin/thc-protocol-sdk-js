import { ThriveBridgeDestination, ThriveBridgeSource } from './ThriveBridge';
import { ThriveWorkerUnit } from './ThriveWorkerUnit';
import { ThriveReview } from './ThriveReview';
import { ThriveStaking } from './ThriveStaking';
import { ThriveOraclePriceStore } from './ThriveOraclePriceStore';
import { ThriveComplianceStore } from './ThriveComplianceStore';
import ThriveFeatureNotInitializedError from './errors/ThriveFeatureNotInitializedError';
export class ThriveProtocol {
    constructor(params) {
        this.provider = params.provider;
        this.wallet = params.wallet;
        if (params.bridge) {
            this._thriveBridgeSource = new ThriveBridgeSource({
                provider: params.bridge.sourceProvider ?? params.provider,
                wallet: params.bridge.sourceWallet ?? params.wallet,
                sourceAddress: params.bridge.sourceAddress,
                sourceContractType: params.bridge.sourceContractType,
                destinationAddress: params.bridge.destinationAddress,
                tokenAddress: params.bridge.sourceTokenAddress
            });
            this._thriveBridgeDestination = new ThriveBridgeDestination({
                provider: params.bridge.destinationProvider ?? params.provider,
                wallet: params.bridge.destinationWallet ?? params.wallet,
                sourceAddress: params.bridge.sourceAddress,
                destinationAddress: params.bridge.destinationAddress,
                tokenAddress: params.bridge.destinationTokenAddress,
                destinationContractType: params.bridge.destinationContractType
            });
        }
        if (params.workerUnit) {
            this._thriveWorkerUnit = new ThriveWorkerUnit(params.workerUnit.factoryAddress, params.workerUnit.wallet ?? params.wallet, params.workerUnit.provider ?? params.provider, params.workerUnit.contractAddress);
        }
        if (params.review) {
            this._thriveReview = new ThriveReview(params.review.factoryAddress, params.review.wallet ?? params.wallet, params.review.provider ?? params.provider, params.review.contractAddress);
        }
        if (params.stake) {
            this._thriveStaking = new ThriveStaking({
                wallet: this.wallet,
                provider: this.provider,
                nativeAddress: params.stake.nativeAddress,
                ierc20Address: params.stake.ierc20Address,
                token: params.stake.token,
                yieldRate: params.stake.yieldRate,
                minStakingAmount: params.stake.minStakingAmount,
                accessControlEnumerable: params.stake.accessControlEnumerable,
                role: params.stake.role
            }, params.stake.stakingType);
        }
        if (params.oraclePrice) {
            this._thriveOraclePrice = new ThriveOraclePriceStore({
                wallet: params.oraclePrice.wallet ?? this.wallet,
                provider: params.oraclePrice.provider ?? this.provider,
                address: params.oraclePrice.address
            });
        }
        if (params.compliance) {
            this._compliance = new ThriveComplianceStore({
                wallet: params.compliance.wallet ?? this.wallet,
                provider: params.compliance.provider ?? this.provider,
                address: params.compliance.address
            });
        }
    }
    get thriveBridgeSource() {
        if (!this._thriveBridgeSource) {
            throw new ThriveFeatureNotInitializedError();
        }
        return this._thriveBridgeSource;
    }
    get thriveBridgeDestination() {
        if (!this._thriveBridgeDestination) {
            throw new ThriveFeatureNotInitializedError();
        }
        return this._thriveBridgeDestination;
    }
    get thriveWorkerUnit() {
        if (!this._thriveWorkerUnit) {
            throw new ThriveFeatureNotInitializedError();
        }
        return this._thriveWorkerUnit;
    }
    get thriveReview() {
        if (!this._thriveReview) {
            throw new ThriveFeatureNotInitializedError();
        }
        return this._thriveReview;
    }
    get thriveStaking() {
        if (!this._thriveStaking) {
            throw new ThriveFeatureNotInitializedError();
        }
        return this._thriveStaking;
    }
    get thriveOraclePrice() {
        if (!this._thriveOraclePrice) {
            throw new ThriveFeatureNotInitializedError();
        }
        return this._thriveOraclePrice;
    }
    get compliance() {
        if (!this._compliance) {
            throw new ThriveFeatureNotInitializedError();
        }
        return this._compliance;
    }
}
