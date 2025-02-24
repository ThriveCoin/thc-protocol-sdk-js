import { ethers, keccak256 } from 'ethers';
import ThriveComplianceStoreABI from './abis/ThriveComplianceStore.json';
import ThriveProviderMissingError from './errors/ThriveProviderMissingError';
import ThriveWalletMissingError from './errors/ThriveWalletMissingError';
export class ThriveComplianceStore {
    constructor(params) {
        this.wallet = params.wallet;
        this.provider = params.provider;
        if (!this.provider && !this.wallet) {
            throw new ThriveProviderMissingError();
        }
        this.contract = new ethers.Contract(params.address, ThriveComplianceStoreABI, this.wallet || this.provider);
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
    async setCheckTypeValidityDuration(checkType, duration) {
        if (!this.wallet) {
            throw new ThriveWalletMissingError();
        }
        const tx = await this.contract.setCheckTypeValidityDuration(keccak256(checkType), duration.toString());
        await tx.wait();
        return tx.hash;
    }
    async setComplianceCheck(checkType, account, passed) {
        if (!this.wallet) {
            throw new ThriveWalletMissingError();
        }
        const tx = await this.contract.setComplianceCheck(keccak256(checkType), account, passed);
        await tx.wait();
        return tx.hash;
    }
    async removeComplianceCheck(checkType, account) {
        if (!this.wallet) {
            throw new ThriveWalletMissingError();
        }
        const tx = await this.contract.setComplianceCheck(keccak256(checkType), account);
        await tx.wait();
        return tx.hash;
    }
    async passedComplianceCheck(checkType, account) {
        const res = await this.contract.passedComplianceCheck(keccak256(checkType), account);
        return res;
    }
}
