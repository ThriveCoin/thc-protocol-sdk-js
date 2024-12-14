"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThriveBridgeDestination = exports.ThriveBridgeSource = exports.ThriveBridge = exports.ThriveBridgeEventEnum = exports.ThriveBridgeSourceType = void 0;
const ethers_1 = require("ethers");
const events_1 = require("events");
const ThriveIERC20Wrapper_json_1 = __importDefault(require("./abis/ThriveIERC20Wrapper.json"));
const ThriveBridgeSourceIERC20_json_1 = __importDefault(require("./abis/ThriveBridgeSourceIERC20.json"));
const ThriveBridgeSourceNative_json_1 = __importDefault(require("./abis/ThriveBridgeSourceNative.json"));
const ThriveBridgeDestination_json_1 = __importDefault(require("./abis/ThriveBridgeDestination.json"));
const ThriveWalletMissingError_1 = __importDefault(require("./errors/ThriveWalletMissingError"));
var ThriveBridgeSourceType;
(function (ThriveBridgeSourceType) {
    ThriveBridgeSourceType["IERC20"] = "IERC20";
    ThriveBridgeSourceType["NATIVE"] = "NATIVE";
})(ThriveBridgeSourceType || (exports.ThriveBridgeSourceType = ThriveBridgeSourceType = {}));
var ThriveBridgeEventEnum;
(function (ThriveBridgeEventEnum) {
    ThriveBridgeEventEnum["TokenLocked"] = "TokenLocked";
    ThriveBridgeEventEnum["TokenUnlocked"] = "TokenUnlocked";
    ThriveBridgeEventEnum["TokenMinted"] = "TokenMinted";
    ThriveBridgeEventEnum["TokenBurned"] = "TokenBurned";
})(ThriveBridgeEventEnum || (exports.ThriveBridgeEventEnum = ThriveBridgeEventEnum = {}));
class ThriveBridge {
    constructor(params) {
        this.eventListenerCount = new Map([
            [ThriveBridgeEventEnum.TokenLocked, 0],
            [ThriveBridgeEventEnum.TokenUnlocked, 0],
            [ThriveBridgeEventEnum.TokenMinted, 0],
            [ThriveBridgeEventEnum.TokenBurned, 0]
        ]);
        this.wallet = params.wallet;
        this.provider = params.provider;
        this.sourceAddress = params.sourceAddress;
        this.destinationAddress = params.destinationAddress;
        this.tokenAddress = params.tokenAddress;
        if (this.tokenAddress) {
            this.tokenContract = new ethers_1.ethers.Contract(this.tokenAddress, ThriveIERC20Wrapper_json_1.default, this.wallet ?? this.provider);
        }
        this.eventInterface = new ethers_1.ethers.Interface([
            ...ThriveBridgeSourceIERC20_json_1.default.filter(x => x.type === 'event'),
            ...ThriveBridgeDestination_json_1.default.filter(x => x.type === 'event')
        ]);
        this.eventListener =
            new events_1.EventEmitter({ captureRejections: true });
    }
    async prepareSignature(contract, sender, receiver, amount, nonce) {
        if (!this.wallet) {
            throw new ThriveWalletMissingError_1.default();
        }
        const hash = ethers_1.ethers.keccak256(ethers_1.ethers.solidityPacked(['address', 'address', 'address', 'uint256', 'uint256'], [contract, sender, receiver, nonce, amount]));
        const signature = await this.wallet.signMessage(ethers_1.ethers.getBytes(hash));
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
            throw new ThriveWalletMissingError_1.default();
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
                type: type,
                sender: parsed.args[0].toString(),
                receiver: parsed.args[1].toString(),
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
    eventListenerFunc(sender, receiver, amount, timestamp, nonce, signature, ev) {
        const type = ev.fragment.name;
        this.eventListener.emit(type, {
            type,
            sender: sender.toString(),
            receiver: receiver.toString(),
            amount: amount.toString(),
            timestamp: Number(timestamp) * 1000,
            nonce: nonce.toString(),
            signature: signature.toString(),
            block: ev.log.blockNumber.toString(),
            tx: ev.log.transactionHash
        });
    }
    onBridgeEvent(type, listener) {
        this.eventListener.addListener(type, listener);
        const count = this.eventListenerCount.get(type);
        if (count === 0) {
            // set listener on contract
            this.bridgeContract.on(type, this.eventListenerFunc.bind(this));
        }
        this.eventListenerCount.set(type, count + 1);
    }
    offBridgeEvent(type, listener) {
        if (listener) {
            this.eventListener.removeListener(type, listener);
            const count = this.eventListenerCount.get(type) - 1;
            if (count === 0) {
                // set off listener on contract
                this.bridgeContract.off(type);
            }
            if (count >= 0) {
                this.eventListenerCount.set(type, count);
            }
        }
        else {
            this.eventListener.removeAllListeners(type);
            this.bridgeContract.off(type);
            this.eventListenerCount.set(type, 0);
        }
    }
}
exports.ThriveBridge = ThriveBridge;
class ThriveBridgeSource extends ThriveBridge {
    constructor(params) {
        super(params);
        this.contractType = params.sourceContractType;
        if (this.contractType === ThriveBridgeSourceType.IERC20 && !this.tokenAddress) {
            throw new Error('ThriveProtocol: token address required');
        }
        this.bridgeContract = new ethers_1.ethers.Contract(this.sourceAddress, this.contractType === ThriveBridgeSourceType.NATIVE ? ThriveBridgeSourceNative_json_1.default : ThriveBridgeSourceIERC20_json_1.default, this.wallet ?? this.provider);
    }
    async getTokenDecimals() {
        if (this.contractType === ThriveBridgeSourceType.NATIVE) {
            return 18;
        }
        return super.getTokenDecimals();
    }
    async lockTokens(params) {
        if (!this.wallet) {
            throw new ThriveWalletMissingError_1.default();
        }
        const { receiver } = params;
        const amountUnit = params.amountUnit ?? ethers_1.ethers.parseUnits(params.amount, await this.getTokenDecimals()).toString();
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
            throw new ThriveWalletMissingError_1.default();
        }
        const { sender, receiver, nonce, signature } = params;
        const amountUnit = params.amountUnit ?? ethers_1.ethers.parseUnits(params.amount, await this.getTokenDecimals()).toString();
        const tx = await this.bridgeContract.unlockTokens(sender, receiver, amountUnit, nonce, signature);
        await tx.wait();
        return tx.hash;
    }
    async getBridgeEvents(type, from, to) {
        return super.getBridgeEvents(type, from, to);
    }
    onBridgeEvent(type, listener) {
        super.onBridgeEvent(type, listener);
    }
    offBridgeEvent(type, listener) {
        super.offBridgeEvent(type, listener);
    }
}
exports.ThriveBridgeSource = ThriveBridgeSource;
class ThriveBridgeDestination extends ThriveBridge {
    constructor(params) {
        super(params);
        if (!this.tokenAddress) {
            throw new Error('ThriveProtocol: token address required');
        }
        this.bridgeContract = new ethers_1.ethers.Contract(this.destinationAddress, ThriveBridgeDestination_json_1.default, this.wallet ?? this.provider);
    }
    async mintTokens(params) {
        if (!this.wallet) {
            throw new ThriveWalletMissingError_1.default();
        }
        const { sender, receiver, nonce, signature } = params;
        const amountUnit = params.amountUnit ?? ethers_1.ethers.parseUnits(params.amount, await this.getTokenDecimals()).toString();
        const tx = await this.bridgeContract.mintTokens(sender, receiver, amountUnit, nonce, signature);
        await tx.wait();
        return tx.hash;
    }
    async burnTokens(params) {
        if (!this.wallet) {
            throw new ThriveWalletMissingError_1.default();
        }
        const { receiver } = params;
        const sender = this.wallet.address;
        const amountUnit = params.amountUnit ?? ethers_1.ethers.parseUnits(params.amount, await this.getTokenDecimals()).toString();
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
    onBridgeEvent(type, listener) {
        super.onBridgeEvent(type, listener);
    }
    offBridgeEvent(type, listener) {
        super.offBridgeEvent(type, listener);
    }
}
exports.ThriveBridgeDestination = ThriveBridgeDestination;
