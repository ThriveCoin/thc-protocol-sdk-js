"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ThriveWalletMissingError extends Error {
    constructor() {
        super('ThriveProtocol: wallet missing');
    }
}
exports.default = ThriveWalletMissingError;
