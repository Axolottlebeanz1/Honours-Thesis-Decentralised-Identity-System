const mongoose = require("mongoose");

// Stores basic information about issued credentials so the application can list and search them without repeatedly querying the blockchain.
// The blockchain stores the credential hash, issuer address and revocation status. 
// This collection stores additional metadata, such as the issuer and subject DIDs, credential type and IPFS CID.
// The actual credential claims (credentialSubject) are not stored here. They are kept in an AES-256-GCM encrypted file on IPFS.
const CredentialSchema = new mongoose.Schema(
  {
    credentialHash: { type: String, required: true, unique: true, index: true },
    issuerDID: { type: String, required: true, index: true },
    subjectDID: { type: String, required: true, index: true },
    issuerAddress: { type: String, required: true, index: true },
    type: [{ type: String }],
    ipfsCid: { type: String, required: true }, 
    issuedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date },
    status: { type: String, enum: ["valid", "revoked"], default: "valid" },
    txHash: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Credential", CredentialSchema);
