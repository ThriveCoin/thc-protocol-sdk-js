import { ethers } from 'ethers';
import ThriveIERC20WrapperABI from './abis/ThriveIERC20Wrapper.json';
import ThriveBridgeSourceIERC20ABI from './abis/ThriveBridgeSourceIERC20.json';
import ThriveBridgeSourceNativeABI from './abis/ThriveBridgeSourceNative.json';
import ThriveBridgeDestinationABI from './abis/ThriveBridgeDestination.json';
import ThriveWalletMissingError from './errors/ThriveWalletMissingError';
export var ThriveBridgeSourceType;
(function (ThriveBridgeSourceType) {
    ThriveBridgeSourceType["IERC20"] = "IERC20";
    ThriveBridgeSourceType["NATIVE"] = "NATIVE";
})(ThriveBridgeSourceType || (ThriveBridgeSourceType = {}));
export class ThriveBridge {
    constructor(params) {
        this.wallet = params.wallet;
        this.provider = params.provider;
        this.sourceAddress = params.sourceAddress;
        this.destinationAddress = params.destinationAddress;
        this.tokenAddress = params.tokenAddress;
        if (this.tokenAddress) {
            this.tokenContract = new ethers.Contract(this.tokenAddress, ThriveIERC20WrapperABI, this.wallet ?? this.provider);
        }
        this.eventInterface = new ethers.Interface([
            ...ThriveBridgeSourceIERC20ABI.filter(x => x.type === 'event'),
            ...ThriveBridgeDestinationABI.filter(x => x.type === 'event')
        ]);
    }
    async prepareSignature(contract, sender, receiver, amount, nonce) {
        if (!this.wallet) {
            throw new ThriveWalletMissingError();
        }
        const hash = ethers.keccak256(ethers.solidityPacked(['address', 'address', 'address', 'uint256', 'uint256'], [contract, sender, receiver, nonce, amount]));
        const signature = await this.wallet.signMessage(ethers.getBytes(hash));
        return signature;
    }
    async getTokenDecimals() {
        this.tokenDecimals ?? (this.tokenDecimals = +(await this.tokenContract.decimals()).toString());
        return this.tokenDecimals;
    }
    setWallet(wallet) {
        this.wallet = wallet;
        this.bridgeContract = this.bridgeContract.connect(this.wallet);
    }
    getWallet() {
        if (!this.wallet) {
            throw new ThriveWalletMissingError();
        }
        return this.wallet.address;
    }
    async getBridgeEvents(type, from, to) {
        const eventFilter = this.bridgeContract.filters[type]();
        from = typeof from !== 'number' && from !== 'latest' ? +(from.toString()) : from;
        to = typeof to !== 'number' && to !== 'latest' ? +(to.toString()) : to;
        const raw = await this.bridgeContract.queryFilter(eventFilter, from, to);
        const events = [];
        for (const ev of raw) {
            const parsed = this.eventInterface.parseLog(ev);
            if (!parsed) {
                continue;
            }
            events.push({
                sender: parsed.args[0],
                receiver: parsed.args[1],
                amount: parsed.args[2].toString(),
                timestamp: Number(parsed.args[3]) * 1000,
                nonce: parsed.args[4].toString(),
                signature: parsed.args[5].toString(),
                block: ev.blockNumber.toString(),
                tx: ev.transactionHash
            });
        }
        return events;
    }
}
export class ThriveBridgeSource extends ThriveBridge {
    constructor(params) {
        super(params);
        this.contractType = params.sourceContractType;
        if (this.contractType === ThriveBridgeSourceType.IERC20 && !this.tokenAddress) {
            throw new Error('ThriveProtocol: token address required');
        }
        this.bridgeContract = new ethers.Contract(this.sourceAddress, this.contractType === ThriveBridgeSourceType.NATIVE ? ThriveBridgeSourceNativeABI : ThriveBridgeSourceIERC20ABI, this.wallet ?? this.provider);
    }
    async getTokenDecimals() {
        if (this.contractType === ThriveBridgeSourceType.NATIVE) {
            return 18;
        }
        return super.getTokenDecimals();
    }
    async lockTokens(params) {
        if (!this.wallet) {
            throw new ThriveWalletMissingError();
        }
        const { receiver } = params;
        const amountUnit = params.amountUnit ?? ethers.parseUnits(params.amount, await this.getTokenDecimals()).toString();
        const sender = this.wallet.address;
        const nonce = (await this.bridgeContract.lockNonces(this.wallet.address)).toString();
        const signature = await this.prepareSignature(this.sourceAddress, sender, receiver, amountUnit, nonce);
        if (this.contractType === ThriveBridgeSourceType.IERC20) {
            const ercTx = await this.tokenContract.approve(this.sourceAddress, amountUnit);
            await ercTx.wait();
        }
        const tx = await this.bridgeContract.lockTokens(receiver, amountUnit, signature, { value: this.contractType === ThriveBridgeSourceType.NATIVE ? amountUnit : '0' });
        await tx.wait();
        return tx.hash;
    }
    async unlockTokens(params) {
        if (!this.wallet) {
            throw new ThriveWalletMissingError();
        }
        const { sender, receiver, nonce, signature } = params;
        const amountUnit = params.amountUnit ?? ethers.parseUnits(params.amount, await this.getTokenDecimals()).toString();
        const tx = await this.bridgeContract.unlockTokens(sender, receiver, amountUnit, nonce, signature);
        await tx.wait();
        return tx.hash;
    }
    async getBridgeEvents(type, from, to) {
        return super.getBridgeEvents(type, from, to);
    }
}
export class ThriveBridgeDestination extends ThriveBridge {
    constructor(params) {
        super(params);
        if (!this.tokenAddress) {
            throw new Error('ThriveProtocol: token address required');
        }
        this.bridgeContract = new ethers.Contract(this.destinationAddress, ThriveBridgeDestinationABI, this.wallet ?? this.provider);
    }
    async mintTokens(params) {
        if (!this.wallet) {
            throw new ThriveWalletMissingError();
        }
        const { sender, receiver, nonce, signature } = params;
        const amountUnit = params.amountUnit ?? ethers.parseUnits(params.amount, await this.getTokenDecimals()).toString();
        const tx = await this.bridgeContract.mintTokens(sender, receiver, amountUnit, nonce, signature);
        await tx.wait();
        return tx.hash;
    }
    async burnTokens(params) {
        if (!this.wallet) {
            throw new ThriveWalletMissingError();
        }
        const { receiver } = params;
        const sender = this.wallet.address;
        const amountUnit = params.amountUnit ?? ethers.parseUnits(params.amount, await this.getTokenDecimals()).toString();
        const nonce = (await this.bridgeContract.burnNonces(this.wallet.address)).toString();
        const signature = await this.prepareSignature(this.destinationAddress, sender, receiver, amountUnit, nonce);
        const ercTx = await this.tokenContract.approve(this.destinationAddress, amountUnit);
        await ercTx.wait();
        const tx = await this.bridgeContract.burnTokens(receiver, amountUnit, signature);
        await tx.wait();
        return tx.hash;
    }
    async getBridgeEvents(type, from, to) {
        return super.getBridgeEvents(type, from, to);
    }
}
