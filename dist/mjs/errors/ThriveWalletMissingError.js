export default class ThriveWalletMissingError extends Error {
    constructor() {
        super('ThriveProtocol: wallet missing');
    }
}
