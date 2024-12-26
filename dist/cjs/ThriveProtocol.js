"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThriveProtocol = void 0;
const ThriveBridge_1 = require("./ThriveBridge");
const ThriveWorkerUnit_1 = require("./ThriveWorkerUnit");
const ThriveFeatureNotInitializedError_1 = __importDefault(require("./errors/ThriveFeatureNotInitializedError"));
class ThriveProtocol {
    constructor(params) {
        this.provider = params.provider;
        this.wallet = params.wallet;
        if (params.bridge) {
            this._thriveBridgeSource = new ThriveBridge_1.ThriveBridgeSource({
                provider: params.bridge.sourceProvider ?? params.provider,
                wallet: params.bridge.sourceWallet ?? params.wallet,
                sourceAddress: params.bridge.sourceAddress,
                sourceContractType: params.bridge.sourceContractType,
                destinationAddress: params.bridge.destinationAddress,
                tokenAddress: params.bridge.sourceTokenAddress
            });
            this._thriveBridgeDestination = new ThriveBridge_1.ThriveBridgeDestination({
                provider: params.bridge.destinationProvider ?? params.provider,
                wallet: params.bridge.destinationWallet ?? params.wallet,
                sourceAddress: params.bridge.sourceAddress,
                destinationAddress: params.bridge.destinationAddress,
                tokenAddress: params.bridge.destinationTokenAddress
            });
        }
        if (params.workerUnit) {
            this._thriveWorkerUnit = new ThriveWorkerUnit_1.ThriveWorkerUnit(params.workerUnit.factoryAddress, params.workerUnit.wallet ?? params.wallet, params.workerUnit.provider ?? params.provider, params.workerUnit.contractAddress);
        }
    }
    get thriveBridgeSource() {
        if (!this._thriveBridgeSource) {
            throw new ThriveFeatureNotInitializedError_1.default();
        }
        return this._thriveBridgeSource;
    }
    get thriveBridgeDestination() {
        if (!this._thriveBridgeDestination) {
            throw new ThriveFeatureNotInitializedError_1.default();
        }
        return this._thriveBridgeDestination;
    }
    get thriveWorkerUnit() {
        if (!this._thriveWorkerUnit) {
            throw new ThriveFeatureNotInitializedError_1.default();
        }
        return this._thriveWorkerUnit;
    }
}
exports.ThriveProtocol = ThriveProtocol;
