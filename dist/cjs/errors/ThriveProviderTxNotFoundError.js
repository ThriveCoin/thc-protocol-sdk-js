"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ThriveProviderTxNotFoundError extends Error {
    constructor() {
        super('ThriveProtocol: transaction not found');
    }
}
exports.default = ThriveProviderTxNotFoundError;
