const mongoose = require("mongoose");

// Stores basic information about registered DIDs so the application can search and display profiles without scanning blockchain logs.
// The blockchain remains the source of truth for DID ownership and status.
// This schema provides an off chain copy of the profile details to make them easier to retrieve.
const DIDProfileSchema = new mongoose.Schema(
  {
    did: { type: String, required: true, unique: true, index: true },
    controllerAddress: { type: String, required: true, unique: true, index: true },
    docCID: { type: String, required: true }, // IPFS CID of the AES-256-GCM encrypted DID Document
    displayName: { type: String },
    avatarUrl: { type: String },
    active: { type: Boolean, default: true },
    txHash: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DIDProfile", DIDProfileSchema);
