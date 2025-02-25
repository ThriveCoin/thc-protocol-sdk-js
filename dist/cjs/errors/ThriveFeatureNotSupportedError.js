"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ThriveFeatureNotSupportedError extends Error {
    constructor() {
        super('ThriveProtocol: feature not supported');
    }
}
exports.default = ThriveFeatureNotSupportedError;
