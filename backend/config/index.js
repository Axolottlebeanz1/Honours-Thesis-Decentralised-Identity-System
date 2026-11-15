const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

module.exports = {
  port: process.env.PORT || 4000,
  mongoUri: process.env.MONGO_URI || "mongodb://localhost:27017/decentralized-identity",
  rpcUrl: process.env.RPC_URL || "http://127.0.0.1:8545",
  privateKey: process.env.RELAYER_PRIVATE_KEY || "",
  didRegistryAddress: process.env.DID_REGISTRY_ADDRESS || "",
  credentialRegistryAddress: process.env.CREDENTIAL_REGISTRY_ADDRESS || "",
  ipfsApiUrl: process.env.IPFS_API_URL || "http://127.0.0.1:5001",
  jwtSecret: process.env.JWT_SECRET || "",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "12h",
  // 32-byte AES-256 key. Generate with: openssl rand -hex 32
  encryptionKey: process.env.ENCRYPTION_KEY || "",
};
