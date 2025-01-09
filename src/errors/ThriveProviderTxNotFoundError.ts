export default class ThriveProviderTxNotFoundError extends Error {
  constructor () {
    super('ThriveProtocol: transaction not found')
  }
}
