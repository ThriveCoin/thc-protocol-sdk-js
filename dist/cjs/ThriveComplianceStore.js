"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThriveComplianceStore = void 0;
const ethers_1 = require("ethers");
const ThriveComplianceStore_json_1 = __importDefault(require("./abis/ThriveComplianceStore.json"));
const ThriveProviderMissingError_1 = __importDefault(require("./errors/ThriveProviderMissingError"));
const ThriveWalletMissingError_1 = __importDefault(require("./errors/ThriveWalletMissingError"));
class ThriveComplianceStore {
    constructor(params) {
        this.wallet = params.wallet;
        this.provider = params.provider;
        if (!this.provider && !this.wallet) {
            throw new ThriveProviderMissingError_1.default();
        }
        this.contract = new ethers_1.ethers.Contract(params.address, ThriveComplianceStore_json_1.default, this.wallet || this.provider);
    }
    setWallet(wallet) {
        this.wallet = wallet;
        if (this.contract) {
            this.contract = this.contract.connect(wallet);
        }
    }
    getWalletAddress() {
        if (!this.wallet) {
            throw new ThriveWalletMissingError_1.default();
        }
        return this.wallet.address;
    }
    async setCheckTypeValidityDuration(checkType, duration) {
        if (!this.wallet) {
            throw new ThriveWalletMissingError_1.default();
        }
        const tx = await this.contract.setCheckTypeValidityDuration((0, ethers_1.keccak256)(checkType), duration.toString());
        await tx.wait();
        return tx.hash;
    }
    async setComplianceCheck(checkType, account, passed) {
        if (!this.wallet) {
            throw new ThriveWalletMissingError_1.default();
        }
        const tx = await this.contract.setComplianceCheck((0, ethers_1.keccak256)(checkType), account, passed);
        await tx.wait();
        return tx.hash;
    }
    async removeComplianceCheck(checkType, account) {
        if (!this.wallet) {
            throw new ThriveWalletMissingError_1.default();
        }
        const tx = await this.contract.setComplianceCheck((0, ethers_1.keccak256)(checkType), account);
        await tx.wait();
        return tx.hash;
    }
    async passedComplianceCheck(checkType, account) {
        const res = await this.contract.passedComplianceCheck((0, ethers_1.keccak256)(checkType), account);
        return res;
    }
}
exports.ThriveComplianceStore = ThriveComplianceStore;
