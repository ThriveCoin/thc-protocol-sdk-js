"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThriveOraclePriceStore = void 0;
const ethers_1 = require("ethers");
const ThriveOraclePriceStore_json_1 = __importDefault(require("./abis/ThriveOraclePriceStore.json"));
const ThriveProviderMissingError_1 = __importDefault(require("./errors/ThriveProviderMissingError"));
const ThriveWalletMissingError_1 = __importDefault(require("./errors/ThriveWalletMissingError"));
class ThriveOraclePriceStore {
    constructor(params) {
        this.wallet = params.wallet;
        this.provider = params.provider;
        if (!this.provider && !this.wallet) {
            throw new ThriveProviderMissingError_1.default();
        }
        this.contract = new ethers_1.ethers.Contract(params.address, ThriveOraclePriceStore_json_1.default, this.wallet || this.provider);
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
    async setPrice(pair, price) {
        if (!this.wallet) {
            throw new ThriveWalletMissingError_1.default();
        }
        const tx = await this.contract.setPrice(pair, price);
        await tx.wait();
        return tx.hash;
    }
    async getPrice(pair) {
        const res = await this.contract.getPrice(pair);
        return {
            pair,
            price: res[0].toString(),
            updatedAt: Number(res[1]) * 1000,
            updatedBy: res[2].toString()
        };
    }
    async decimals() {
        const res = await this.contract.decimals();
        return res.toString();
    }
}
exports.ThriveOraclePriceStore = ThriveOraclePriceStore;
