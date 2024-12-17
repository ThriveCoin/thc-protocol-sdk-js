"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ThriveProviderMissingError extends Error {
    constructor() {
        super('ThriveProtocol: provider missing');
    }
}
exports.default = ThriveProviderMissingError;
