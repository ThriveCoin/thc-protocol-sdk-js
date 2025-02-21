import { ethers } from 'ethers';
import ThriveOraclePriceStoreABI from './abis/ThriveOraclePriceStore.json';
import ThriveProviderMissingError from './errors/ThriveProviderMissingError';
import ThriveWalletMissingError from './errors/ThriveWalletMissingError';
export class ThriveOraclePriceStore {
    constructor(params) {
        this.wallet = params.wallet;
        this.provider = params.provider;
        if (!this.provider && !this.wallet) {
            throw new ThriveProviderMissingError();
        }
        this.contract = new ethers.Contract(params.address, ThriveOraclePriceStoreABI, this.wallet || this.provider);
    }
    setWallet(wallet) {
        this.wallet = wallet;
        if (this.contract) {
            this.contract = this.contract.connect(wallet);
        }
    }
    getWalletAddress() {
        if (!this.wallet) {
            throw new ThriveWalletMissingError();
        }
        return this.wallet.address;
    }
    async setPrice(pair, price) {
        if (!this.wallet) {
            throw new ThriveWalletMissingError();
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
}
