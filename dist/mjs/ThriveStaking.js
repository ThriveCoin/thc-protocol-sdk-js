import { ethers } from 'ethers';
import { EventEmitter } from 'events';
import ThriveStakingNativeABI from './abis/ThriveStakingNative.json';
import ThriveStakingIERC20ABI from './abis/ThriveStakingIERC20.json';
import ThriveWalletMissingError from './errors/ThriveWalletMissingError';
import ThriveProviderMissingError from './errors/ThriveProviderMissingError';
import ThriveContractNotInitializedError from './errors/ThriveContractNotInitialized';
export var ThriveStakingType;
(function (ThriveStakingType) {
    ThriveStakingType["IERC20"] = "IERC20";
    ThriveStakingType["NATIVE"] = "NATIVE";
})(ThriveStakingType || (ThriveStakingType = {}));
export var ThriveStakingEventEnum;
(function (ThriveStakingEventEnum) {
    ThriveStakingEventEnum["Staked"] = "Staked";
    ThriveStakingEventEnum["Withdrawn"] = "Withdrawn";
    ThriveStakingEventEnum["YieldClaimed"] = "YieldClaimed";
})(ThriveStakingEventEnum || (ThriveStakingEventEnum = {}));
export class ThriveStaking {
    constructor(params, stakingType = ThriveStakingType.IERC20) {
        this.eventListenerCount = new Map([
            [ThriveStakingEventEnum.Withdrawn, 0],
            [ThriveStakingEventEnum.YieldClaimed, 0],
            [ThriveStakingEventEnum.Staked, 0]
        ]);
        this.wallet = params.wallet;
        this.provider = params.provider;
        this.nativeAddress = params.nativeAddress;
        this.ierc20Address = params.ierc20Address;
        this.token = params.token;
        this.stakingType = stakingType;
        this.initContract();
        const eventAbis = [
            ...ThriveStakingNativeABI.filter((item) => item.type === 'event'),
            ...ThriveStakingIERC20ABI.filter((item) => item.type === 'event')
        ];
        this.eventInterface = new ethers.Interface(eventAbis);
        this.eventListener =
            new EventEmitter({ captureRejections: true });
    }
    initContract() {
        if (!this.provider && !this.wallet) {
            throw new ThriveProviderMissingError();
        }
        const signerOrProvider = this.wallet || this.provider;
        if (this.stakingType === ThriveStakingType.NATIVE) {
            this.contract = new ethers.Contract(this.nativeAddress, ThriveStakingNativeABI, signerOrProvider);
        }
        else {
            this.contract = new ethers.Contract(this.ierc20Address, ThriveStakingIERC20ABI, signerOrProvider);
        }
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
    switchStakingType(stakingType) {
        this.stakingType = stakingType;
        this.initContract();
    }
    eventListenerFunc(...args) {
        const ev = args[args.length - 1];
        const type = ev.fragment.name;
        if (type === 'Staked') {
            this.eventListener.emit(type, {
                type,
                user: args[0].toString(),
                amount: args[1].toString(),
                yield: '0',
                timestamp: Date.now(),
                block: ev.log.blockNumber.toString(),
                tx: ev.log.transactionHash
            });
        }
        else if (type === 'Withdrawn') {
            this.eventListener.emit(type, {
                type,
                user: args[0].toString(),
                amount: args[1].toString(),
                yield: args[2].toString(),
                timestamp: Date.now(),
                block: ev.log.blockNumber.toString(),
                tx: ev.log.transactionHash
            });
        }
        else if (type === 'YieldClaimed') {
            this.eventListener.emit(type, {
                type,
                user: args[0].toString(),
                amount: '0',
                yield: args[1].toString(),
                timestamp: Date.now(),
                block: ev.log.blockNumber.toString(),
                tx: ev.log.transactionHash
            });
        }
    }
    onContractEvent(type, listener) {
        this.eventListener.addListener(type, listener);
        const count = this.eventListenerCount.get(type) || 0;
        if (count === 0) {
            this.contract?.on(type, this.eventListenerFunc.bind(this));
        }
        this.eventListenerCount.set(type, count + 1);
    }
    offEvent(eventType, listener) {
        if (listener) {
            this.eventListener.removeListener(eventType, listener);
            const count = (this.eventListenerCount.get(eventType) || 1) - 1;
            if (count === 0) {
                this.contract?.off(eventType);
            }
            this.eventListenerCount.set(eventType, count);
        }
        else {
            this.eventListener.removeAllListeners(eventType);
            this.contract?.off(eventType);
            this.eventListenerCount.set(eventType, 0);
        }
    }
    async stake(amount) {
        if (!this.wallet)
            throw new ThriveWalletMissingError();
        if (!this.contract)
            throw new ThriveContractNotInitializedError();
        let tx;
        if (this.stakingType === ThriveStakingType.NATIVE) {
            tx = await this.contract.stake(amount, { value: amount });
        }
        else {
            tx = await this.contract.stake(amount);
        }
        await tx.wait();
        return tx.hash;
    }
    async withdraw() {
        if (!this.wallet)
            throw new ThriveWalletMissingError();
        if (!this.contract)
            throw new ThriveContractNotInitializedError();
        const tx = await this.contract.withdraw();
        await tx.wait();
        return tx.hash;
    }
    async claimYield() {
        if (!this.wallet)
            throw new ThriveWalletMissingError();
        if (!this.contract)
            throw new ThriveContractNotInitializedError();
        const tx = await this.contract.claimYield();
        await tx.wait();
        return tx.hash;
    }
    async calculateYield(address) {
        if (!this.contract)
            throw new ThriveContractNotInitializedError();
        const userAddress = address || this.getWalletAddress();
        const yieldAmount = await this.contract.calculateYield(userAddress);
        return yieldAmount.toString();
    }
    async setYieldRate(newYieldRate) {
        if (!this.wallet)
            throw new ThriveWalletMissingError();
        if (!this.contract)
            throw new ThriveContractNotInitializedError();
        const tx = await this.contract.setYieldRate(newYieldRate);
        await tx.wait();
        return tx.hash;
    }
    async setMinStakingAmount(newMin) {
        if (!this.wallet)
            throw new ThriveWalletMissingError();
        if (!this.contract)
            throw new ThriveContractNotInitializedError();
        const tx = await this.contract.setMinStakingAmount(newMin);
        await tx.wait();
        return tx.hash;
    }
}
