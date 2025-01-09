export default class ThriveFeatureNotInitializedError extends Error {
    constructor() {
        super('ThriveProtocol: feature not initialized');
    }
}
