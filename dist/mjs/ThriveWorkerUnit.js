import { ethers } from 'ethers';
import { EventEmitter } from 'events';
import ThriveWorkerUnitABI from './abis/ThriveWorkerUnit.json';
import ThriveWorkerUnitFactoryABI from './abis/ThriveWorkerUnitFactory.json';
import ThriveIERC20WrapperABI from './abis/ThriveIERC20Wrapper.json';
import ThriveWalletMissingError from './errors/ThriveWalletMissingError';
import ThriveProviderMissingError from './errors/ThriveProviderMissingError';
import ThriveProviderTxNotFoundError from './errors/ThriveProviderTxNotFoundError';
import ThriveContractNotInitializedError from './errors/ThriveContractNotInitialized';
export var ThriveWorkerUnitTokenType;
(function (ThriveWorkerUnitTokenType) {
    ThriveWorkerUnitTokenType["IERC20"] = "IERC20";
    ThriveWorkerUnitTokenType["NATIVE"] = "NATIVE";
})(ThriveWorkerUnitTokenType || (ThriveWorkerUnitTokenType = {}));
export var ThriveWorkerUnitEventEnum;
(function (ThriveWorkerUnitEventEnum) {
    ThriveWorkerUnitEventEnum["Withdrawn"] = "Withdrawn";
    ThriveWorkerUnitEventEnum["Initialized"] = "Initialized";
    ThriveWorkerUnitEventEnum["ConfirmationAdded"] = "ConfirmationAdded";
})(ThriveWorkerUnitEventEnum || (ThriveWorkerUnitEventEnum = {}));
export class ThriveWorkerUnit {
    constructor(_factoryAddress, _wallet, _provider, _contractAddress) {
        this.eventListenerCount = new Map([
            [ThriveWorkerUnitEventEnum.Initialized, 0],
            [ThriveWorkerUnitEventEnum.ConfirmationAdded, 0],
            [ThriveWorkerUnitEventEnum.Withdrawn, 0]
        ]);
        this.wallet = _wallet;
        this.provider = _provider;
        this.contractAddress = _contractAddress;
        this.factoryAddress = _factoryAddress;
        this.factoryContract = new ethers.Contract(this.factoryAddress, ThriveWorkerUnitFactoryABI, this.wallet ?? this.provider);
        if (this.contractAddress) {
            this.contract = new ethers.Contract(this.contractAddress, ThriveWorkerUnitABI, this.wallet ?? this.provider);
        }
        this.eventInterface = new ethers.Interface(ThriveWorkerUnitABI.filter(x => x.type === 'event'));
        this.eventListener = new EventEmitter({ captureRejections: true });
    }
    setWallet(wallet) {
        this.wallet = wallet;
        this.contract = this.contract?.connect(this.wallet);
        if (this.factoryContract) {
            this.factoryContract = this.factoryContract.connect(this.wallet);
        }
    }
    getWallet() {
        if (!this.wallet) {
            throw new ThriveWalletMissingError();
        }
        return this.wallet.address;
    }
    async createNewWorkerUnit(workerUnitOptions, value) {
        if (!this.wallet) {
            throw new ThriveWalletMissingError();
        }
        if (!this.factoryContract) {
            throw new Error('Factory contract is not deployed');
        }
        const tx = await this.factoryContract.createThriveWorkUnit({
            moderator: workerUnitOptions.moderator,
            rewardToken: workerUnitOptions.rewardToken ?? ethers.ZeroAddress,
            rewardAmount: workerUnitOptions.rewardAmount,
            maxRewards: workerUnitOptions.maxRewards,
            validationRewardAmount: workerUnitOptions.validationRewardAmount,
            deadline: workerUnitOptions.deadline,
            maxCompletionsPerUser: workerUnitOptions.maxCompletionsPerUser,
            validators: workerUnitOptions.validators,
            assignedContributor: workerUnitOptions.assignedContributor,
            badgeQuery: workerUnitOptions.badgeQuery
        }, {
            value
        });
        const receipt = await tx.wait();
        const eventInterface = new ethers.Interface([
            'event ThriveWorkerUnitCreated(address indexed unitAddress)'
        ]);
        let newContractAddress = null;
        receipt.logs.forEach((log) => {
            try {
                const parsedLog = eventInterface.parseLog(log);
                if (parsedLog?.name === 'ThriveWorkerUnitCreated') {
                    newContractAddress = parsedLog.args.unitAddress;
                }
            }
            catch (error) {
                console.error(error);
            }
        });
        if (!newContractAddress) {
            throw new Error('Failed to retrieve new Worker Unit address');
        }
        this.contractAddress = newContractAddress;
        this.contract = new ethers.Contract(newContractAddress, ThriveWorkerUnitABI, this.wallet ?? this.provider);
        const tokenContract = new ethers.Contract(workerUnitOptions.rewardToken ?? ethers.ZeroAddress, ThriveIERC20WrapperABI, this.wallet ?? this.provider);
        if (workerUnitOptions.tokenType === ThriveWorkerUnitTokenType.IERC20) {
            const ercTx = await tokenContract.approve(this.contract, workerUnitOptions.maxRewards);
            await ercTx.wait();
        }
        return newContractAddress;
    }
    async getContractEventsFromHash(hash) {
        if (!this.provider) {
            throw new ThriveProviderMissingError();
        }
        const receipt = await this.provider.getTransactionReceipt(hash);
        if (!receipt) {
            throw new ThriveProviderTxNotFoundError();
        }
        const address = await this.contract?.getAddress();
        const events = [];
        receipt.logs.forEach((log) => {
            if (log.address.toLowerCase() !== address?.toLowerCase()) {
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
            this.contract?.on(type, this.eventListenerFunc.bind(this));
        }
        this.eventListenerCount.set(type, count + 1);
    }
    offContractEvent(type, listener) {
        if (listener) {
            this.eventListener.removeListener(type, listener);
            const count = this.eventListenerCount.get(type) - 1;
            if (count === 0) {
                this.contract?.off(type);
            }
            if (count >= 0) {
                this.eventListenerCount.set(type, count);
            }
        }
        else {
            this.eventListener.removeAllListeners(type);
            this.contract?.off(type);
            this.eventListenerCount.set(type, 0);
        }
    }
    async initialize(value) {
        if (!this.wallet)
            throw new ThriveWalletMissingError();
        if (!this.contract)
            throw new ThriveContractNotInitializedError();
        const tx = await this.contract.initialize({
            value
        });
        await tx.wait();
        return tx.hash;
    }
    async confirm(contributor, inputValidationMetadata) {
        if (!this.wallet)
            throw new ThriveWalletMissingError();
        if (!this.contract)
            throw new ThriveContractNotInitializedError();
        const tx = await this.contract.confirm(contributor, inputValidationMetadata);
        await tx.wait();
        return tx.hash;
    }
    async setAssignedContributor(contributor) {
        if (!this.wallet)
            throw new ThriveWalletMissingError();
        if (!this.contract)
            throw new ThriveContractNotInitializedError();
        const tx = await this.contract.setAssignedContributor(contributor);
        await tx.wait();
        return tx.hash;
    }
    async addRequiredBadge(badge) {
        if (!this.wallet)
            throw new ThriveWalletMissingError();
        if (!this.contract)
            throw new ThriveContractNotInitializedError();
        const tx = await this.contract.addRequiredBadge(badge);
        await tx.wait();
        return tx.hash;
    }
    async removeRequiredBadge(badge) {
        if (!this.wallet)
            throw new ThriveWalletMissingError();
        if (!this.contract)
            throw new ThriveContractNotInitializedError();
        const tx = await this.contract.removeRequiredBadge(badge);
        await tx.wait();
        return tx.hash;
    }
    async setMetadata(metadata, metadataVersion) {
        if (!this.wallet)
            throw new ThriveWalletMissingError();
        if (!this.contract)
            throw new ThriveContractNotInitializedError();
        const metadataTx = await this.contract.setMetadata(metadata);
        const versionTx = await this.contract.setMetadataVersion(metadataVersion);
        await metadataTx.wait();
        await versionTx.wait();
        return JSON.stringify({
            metadata: metadataTx.hash,
            metadataVersion: versionTx.hash
        });
    }
    async setDeadline(deadline) {
        if (!this.wallet)
            throw new ThriveWalletMissingError();
        if (!this.contract)
            throw new ThriveContractNotInitializedError();
        const tx = await this.contract.setDeadline(deadline);
        await tx.wait();
        return tx.hash;
    }
    async withdrawRemaining() {
        if (!this.wallet)
            throw new ThriveWalletMissingError();
        if (!this.contract)
            throw new ThriveContractNotInitializedError();
        const tx = await this.contract.withdrawRemaining();
        await tx.wait();
        return tx.hash;
    }
    async getValidators() {
        if (!this.contract)
            throw new ThriveContractNotInitializedError();
        return await this.contract.getValidators();
    }
    async getRequiredBadges() {
        if (!this.contract)
            throw new ThriveContractNotInitializedError();
        return await this.contract.getRequiredBadges();
    }
    async status() {
        if (!this.contract)
            throw new ThriveContractNotInitializedError();
        return await this.contract.status();
    }
}
