export default class ThriveProviderMissingError extends Error {
    constructor() {
        super('ThriveProtocol: provider missing');
    }
}
