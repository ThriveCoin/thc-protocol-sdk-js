export default class ThriveFeatureNotInitializedError extends Error {
    constructor() {
        super('ThriveProtocol: contract is not initialized');
    }
}
