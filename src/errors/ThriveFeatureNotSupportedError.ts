export default class ThriveFeatureNotSupportedError extends Error {
  constructor () {
    super('ThriveProtocol: feature not supported')
  }
}
