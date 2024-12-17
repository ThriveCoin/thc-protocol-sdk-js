"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThriveWorkerUnit = exports.ThriveWorkerUnitEventEnum = exports.ThriveWorkerUnitTokenType = void 0;
const ethers_1 = require("ethers");
const events_1 = require("events");
const ThriveWorkerUnit_json_1 = __importDefault(require("./abis/ThriveWorkerUnit.json"));
const ThriveWorkerUnitFactory_json_1 = __importDefault(require("./abis/ThriveWorkerUnitFactory.json"));
const ThriveWalletMissingError_1 = __importDefault(require("./errors/ThriveWalletMissingError"));
const ThriveProviderMissingError_1 = __importDefault(require("./errors/ThriveProviderMissingError"));
const ThriveProviderTxNotFoundError_1 = __importDefault(require("./errors/ThriveProviderTxNotFoundError"));
var ThriveWorkerUnitTokenType;
(function (ThriveWorkerUnitTokenType) {
    ThriveWorkerUnitTokenType["IERC20"] = "IERC20";
    ThriveWorkerUnitTokenType["NATIVE"] = "NATIVE";
})(ThriveWorkerUnitTokenType || (exports.ThriveWorkerUnitTokenType = ThriveWorkerUnitTokenType = {}));
var ThriveWorkerUnitEventEnum;
(function (ThriveWorkerUnitEventEnum) {
    ThriveWorkerUnitEventEnum["Withdrawn"] = "Withdrawn";
    ThriveWorkerUnitEventEnum["Initialized"] = "Initialized";
    ThriveWorkerUnitEventEnum["ConfirmationAdded"] = "ConfirmationAdded";
})(ThriveWorkerUnitEventEnum || (exports.ThriveWorkerUnitEventEnum = ThriveWorkerUnitEventEnum = {}));
class ThriveWorkerUnit {
    constructor(params) {
        this.eventListenerCount = new Map([
            [ThriveWorkerUnitEventEnum.Initialized, 0],
            [ThriveWorkerUnitEventEnum.ConfirmationAdded, 0],
            [ThriveWorkerUnitEventEnum.Withdrawn, 0]
        ]);
        this.wallet = params.wallet;
        this.provider = params.provider;
        this.contractAddress = params.contractAddress;
        this.factoryAddress = params.factoryAddress;
        this.contract = new ethers_1.ethers.Contract(this.contractAddress, ThriveWorkerUnit_json_1.default, this.wallet ?? this.provider);
        if (this.factoryAddress) {
            this.factoryContract = new ethers_1.ethers.Contract(this.factoryAddress, ThriveWorkerUnitFactory_json_1.default, this.wallet ?? this.provider);
        }
        this.eventInterface = new ethers_1.ethers.Interface(ThriveWorkerUnit_json_1.default.filter(x => x.type === 'event'));
        this.eventListener = new events_1.EventEmitter({ captureRejections: true });
    }
    async prepareSignature(contract, sender, receiver, amount, nonce) {
        if (!this.wallet) {
            throw new ThriveWalletMissingError_1.default();
        }
        const hash = ethers_1.ethers.keccak256(ethers_1.ethers.solidityPacked(['address', 'address', 'address', 'uint256', 'uint256'], [contract, sender, receiver, nonce, amount]));
        const signature = await this.wallet.signMessage(ethers_1.ethers.getBytes(hash));
        return signature;
    }
    setWallet(wallet) {
        this.wallet = wallet;
        this.contract = this.contract.connect(this.wallet);
        if (this.factoryContract) {
            this.factoryContract = this.factoryContract.connect(this.wallet);
        }
    }
    getWallet() {
        if (!this.wallet) {
            throw new ThriveWalletMissingError_1.default();
        }
        return this.wallet.address;
    }
    async createNewWorkerUnit(...args) {
        if (!this.wallet) {
            throw new ThriveWalletMissingError_1.default();
        }
        if (!this.factoryContract) {
            throw new Error('Factory contract is not initialized');
        }
        const tx = await this.factoryContract.createThriveWorkerUnit(...args);
        const receipt = await tx.wait();
        const event = receipt.events?.find((e) => e.event === 'NewWorkerUnitCreated');
        if (event) {
            const newContractAddress = event.args?.[0];
            return newContractAddress;
        }
        throw new Error('Failed to retrieve new Worker Unit address');
    }
    async getContractEventsFromHash(hash) {
        if (!this.provider) {
            throw new ThriveProviderMissingError_1.default();
        }
        const receipt = await this.provider.getTransactionReceipt(hash);
        if (!receipt) {
            throw new ThriveProviderTxNotFoundError_1.default();
        }
        const address = await this.contract.getAddress();
        const events = [];
        receipt.logs.forEach((log) => {
            if (log.address.toLowerCase() !== address.toLowerCase()) {
                return;
            }
            try {
                const parsed = this.eventInterface.parseLog(log);
                if (!parsed) {
                    return;
                }
                const type = parsed.fragment.name;
                if (!Object.keys(ThriveWorkerUnitEventEnum).includes(type)) {
                    return;
                }
                events.push({
                    type: type,
                    contributor: parsed.args[0]?.toString(),
                    validationMetadata: parsed.args[1]?.toString(),
                    rewardAmount: parsed.args[2]?.toString(),
                    validator: parsed.args[3]?.toString(),
                    token: parsed.args[4]?.toString(),
                    amount: parsed.args[5]?.toString(),
                    timestamp: Number(parsed.args[6]) * 1000,
                    block: receipt.blockNumber.toString(),
                    tx: hash
                });
            }
            catch { }
        });
        return events;
    }
    eventListenerFunc(contributor, validationMetadata, rewardAmount, validator, ev) {
        const type = ev.fragment.name;
        this.eventListener.emit(type, {
            type,
            contributor: contributor.toString(),
            validationMetadata: validationMetadata.toString(),
            rewardAmount: rewardAmount.toString(),
            validator: validator.toString(),
            token: '',
            amount: '',
            timestamp: 0,
            block: ev.log.blockNumber.toString(),
            tx: ev.log.transactionHash
        });
    }
    onContractEvent(type, listener) {
        this.eventListener.addListener(type, listener);
        const count = this.eventListenerCount.get(type);
        if (count === 0) {
            this.contract.on(type, this.eventListenerFunc.bind(this));
        }
        this.eventListenerCount.set(type, count + 1);
    }
    offContractEvent(type, listener) {
        if (listener) {
            this.eventListener.removeListener(type, listener);
            const count = this.eventListenerCount.get(type) - 1;
            if (count === 0) {
                this.contract.off(type);
            }
            if (count >= 0) {
                this.eventListenerCount.set(type, count);
            }
        }
        else {
            this.eventListener.removeAllListeners(type);
            this.contract.off(type);
            this.eventListenerCount.set(type, 0);
        }
    }
}
exports.ThriveWorkerUnit = ThriveWorkerUnit;
