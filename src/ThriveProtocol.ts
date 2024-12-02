import { ethers } from 'ethers'

export class ThriveProtocol {
  protected provider: ethers.Provider

  constructor(provider: ethers.Provider) {
    this.provider = provider
  }
}
