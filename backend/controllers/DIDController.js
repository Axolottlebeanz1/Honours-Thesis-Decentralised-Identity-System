const DIDProfile = require("../models/DIDProfileModel");
const { pinEncryptedJSON, fetchDecryptedJSON } = require("../services/IPFSService");
const blockchainService = require("../services/BlockchainService");
const cache = require("../storage/Cache");
const { addressFromDID } = require("../services/CredentialService");

// POST /api/did
// Encrypts the DID Document using AES-256-GCM and uploads it to IPFS. Returns the CID, which the client then uses when calling
// DIDRegistry.registerDID(did, docCID) from their own wallet. Users can only prepare a DID linked to their authenticated wallet.
exports.prepareDID = async (req, res, next) => {
  try {
    const { did, didDocument } = req.body;
    if (addressFromDID(did) !== req.user.address || didDocument.id !== did) {
      return res.status(403).json({ success: false, message: "DID must belong to the authenticated wallet" });
    }
    const docCID = await pinEncryptedJSON(didDocument);
    res.status(200).json({ success: true, did, docCID });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/did/:address/confirm  { did, txHash, docCID, displayName }
// Confirms that a DID has been registered and adds its details to the MongoDB profile index. 
// The request must come from the wallet owner, and the DID and CID must match the record stored on the blockchain.
exports.confirmDID = async (req, res, next) => {
  try {
    const { address } = req.params;
    const { did, txHash, docCID, displayName } = req.body;
    if (address.toLowerCase() !== req.user.address) {
      return res.status(403).json({ success: false, message: "You may only confirm your own DID" });
    }
    const onChain = await blockchainService.resolveDID(address);
    if (onChain.did !== did || onChain.docCID !== docCID) {
      return res.status(409).json({ success: false, message: "DID/CID do not match the on-chain record" });
    }

    const profile = await DIDProfile.findOneAndUpdate(
      { controllerAddress: address.toLowerCase() },
      { did, docCID, controllerAddress: address.toLowerCase(), displayName, txHash, active: true },
      { upsert: true, new: true }
    );

    cache.del(`did:${address.toLowerCase()}`);
    res.status(201).json({ success: true, profile });
  } catch (err) {
    next(err);
  }
};

// GET /api/did/:address
// Retrieves the DID information from the blockchain and combines it with the additional profile details stored in MongoDB.
// The blockchain is used as the source for the on chain DID record.
exports.resolveDID = async (req, res, next) => {
  try {
    const { address } = req.params;
    const cacheKey = `did:${address.toLowerCase()}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json({ success: true, ...cached, cached: true });

    const [onChain, profile] = await Promise.all([
      blockchainService.resolveDID(address),
      DIDProfile.findOne({ controllerAddress: address.toLowerCase() }),
    ]);

    const result = { onChain, profile };
    cache.set(cacheKey, result, 30);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

// GET /api/did/:address/document   (auth required)
// Gets the document CID from the blockchain, downloads the encrypted document from IPFS, and decrypts it using ENCRYPTION_KEY.
// The original DID Document is returned to the client, while IPFS stores the encrypted version and the blockchain stores only its CID.
exports.getDIDDocument = async (req, res, next) => {
  try {
    const { address } = req.params;
    const cacheKey = `did-doc:${address.toLowerCase()}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json({ success: true, didDocument: cached, cached: true });

    const onChain = await blockchainService.resolveDID(address);
    const didDocument = await fetchDecryptedJSON(onChain.docCID);

    cache.set(cacheKey, didDocument, 60);
    res.json({ success: true, didDocument });
  } catch (err) {
    next(err);
  }
};

// GET /api/did?owner=0x...
// Returns the DID profiles stored in MongoDB. An owner address can be provided to show only that owner's profiles.
// Results are sorted by creation date, with a maximum of 100 returned.
exports.listDIDs = async (req, res, next) => {
  try {
    const filter = req.query.owner ? { controllerAddress: req.query.owner.toLowerCase() } : {};
    const profiles = await DIDProfile.find(filter).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, count: profiles.length, profiles });
  } catch (err) {
    next(err);
  }
};
