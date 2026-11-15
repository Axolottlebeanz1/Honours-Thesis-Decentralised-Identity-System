const { ethers } = require("ethers");
const config = require("../config");
const logger = require("../utils/logger");

const DIDRegistryArtifact = require("../../frontend/src/contracts/DIDRegistry.json");
const CredentialRegistryArtifact = require("../../frontend/src/contracts/CredentialRegistry.json");

// Connects the backend to the DID and Credential smart contracts.
// Most transactions are signed directly by users through their browser wallets, as shown in frontend/src/services/contractService.js.
// This service handles blockchain lookups and can also submit transactions through a backend relayer when required.
class BlockchainService {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.wallet = config.privateKey ? new ethers.Wallet(config.privateKey, this.provider) : null;
    this._didRegistry = null;
    this._credentialRegistry = null;
  }

  // Connects to the DID Registry when it is first needed. 
  // The contract address is checked here rather than during startup, allowing tests and routes to load before the address is configured.
  get didRegistry() {
    if (!this._didRegistry) {
      if (!config.didRegistryAddress) throw new Error("DID_REGISTRY_ADDRESS is not configured");
      this._didRegistry = new ethers.Contract(
        config.didRegistryAddress, DIDRegistryArtifact.abi, this.wallet || this.provider
      );
    }
    return this._didRegistry;
  }

// Connects to the Credential Registry when it is first needed.
// This also allows the application to start without the contract address being configured, provided the registry is not used.
  get credentialRegistry() {
    if (!this._credentialRegistry) {
      if (!config.credentialRegistryAddress) throw new Error("CREDENTIAL_REGISTRY_ADDRESS is not configured");
      this._credentialRegistry = new ethers.Contract(
        config.credentialRegistryAddress, CredentialRegistryArtifact.abi, this.wallet || this.provider
      );
    }
    return this._credentialRegistry;
  }

  // Looks up the DID registered to a wallet address and returns its document CID, owner, registration time and active status.
  async resolveDID(address) {
    const record = await this.didRegistry.resolveDID(address);
    return {
      did: record.did,
      docCID: record.docCID,
      owner: record.owner,
      timestamp: Number(record.timestamp),
      active: record.active,
    };
  }

  async hasActiveDID(address) {
    return this.didRegistry.hasActiveDID(address);
  }

  // Checks whether a credential has been revoked on the blockchain.
  async isRevoked(credentialHash) {
    return this.credentialRegistry.isRevoked(credentialHash);
  }

  async getCredentialRecord(credentialHash) {
    const record = await this.credentialRegistry.getRecord(credentialHash);
    return {
      issuer: record.issuer,
      issued: record.issued,
      revoked: record.revoked,
      issuedAt: Number(record.issuedAt),
      revokedAt: Number(record.revokedAt),
    };
  }

  // Allows the backend relayer to register a credential on the blockchain using its own wallet. 
  // The relayer must be configured with a private key.
  async relayRegisterCredential(credentialHash) {
    if (!this.wallet) throw new Error("Relayer wallet not configured");
    const tx = await this.credentialRegistry.registerCredential(credentialHash);
    logger.info(`Relayed registerCredential tx: ${tx.hash}`);
    return tx.wait();
  }
}

module.exports = new BlockchainService();
