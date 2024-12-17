"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ThriveFeatureNotInitializedError extends Error {
    constructor() {
        super('ThriveProtocol: feature not initialized');
    }
}
exports.default = ThriveFeatureNotInitializedError;
