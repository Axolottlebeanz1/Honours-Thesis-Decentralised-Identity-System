const Credential = require("../models/CredentialModel");
const { pinEncryptedJSON, fetchDecryptedJSON } = require("../services/IPFSService");
const blockchainService = require("../services/BlockchainService");
const credentialService = require("../services/CredentialService");
const { addressFromDID } = credentialService;

const forbidden = (res, message) => res.status(403).json({ success: false, message });

// POST /api/credentials/prepare   (auth required)
// Builds a W3C Verifiable Credential and calculates its hash.
// The credential is not saved at this stage. 
// Instead, the issuer signs the hash with their wallet and sends it to /issue. 
// The issuer must also own the DID being used.
exports.prepareCredential = async (req, res, next) => {
  try {
    const { issuerDID, subjectDID, type, credentialSubject, expiresAt } = req.body;
    if (addressFromDID(issuerDID) !== req.user.address) {
      return forbidden(res, "issuerDID must belong to the authenticated wallet");
    }

    const vc = credentialService.buildCredential({ issuerDID, subjectDID, type, credentialSubject, expiresAt });
    const credentialHash = credentialService.hashCredential(vc);
    res.json({ success: true, credentialHash, vc });
  } catch (err) {
    next(err);
  }
};

// POST /api/credentials/issue   { vc, signature }   (auth required)
// Receives the credential and the issuer's wallet signature.
// The server checks that the signature matches the credential hash and belongs to the logged in issuer. 
// It then adds the signature as proof, encrypts the credential and uploads it to IPFS.
// The issuer can then register the returned hash on the blockchain.
exports.issueCredential = async (req, res, next) => {
  try {
    const { vc, signature } = req.body;
    const issuerAddress = addressFromDID(vc.issuer);
    if (issuerAddress !== req.user.address) {
      return forbidden(res, "VC issuer must belong to the authenticated wallet");
    }

    const credentialHash = credentialService.hashCredential(vc);
    const signer = credentialService.recoverSigner(credentialHash, signature);
    if (signer !== issuerAddress) {
      return res.status(400).json({ success: false, message: "Signature does not match the credential hash and issuer DID" });
    }

    const signedVC = credentialService.attachProof(vc, signature);
    const ipfsCid = await pinEncryptedJSON(signedVC);
    res.json({ success: true, credentialHash, ipfsCid, vc: signedVC });
  } catch (err) {
    next(err);
  }
};

// POST /api/credentials/confirm   (auth required)
// Called after the credential hash has been registered on chain.
// The server checks that the transaction was successful and that the logged in user is the registered issuer. 
// It then saves the credential's basic details in MongoDB for easier lookup.
// The actual claims are not stored in the database and they remain inside the encrypted credential on IPFS.
exports.confirmCredential = async (req, res, next) => {
  try {
    const { credentialHash, issuerDID, subjectDID, type, ipfsCid, expiresAt, txHash } = req.body;

    const record = await blockchainService.getCredentialRecord(credentialHash);
    if (!record.issued) {
      return res.status(409).json({ success: false, message: "Credential hash is not registered on-chain" });
    }
    if (record.issuer.toLowerCase() !== req.user.address) {
      return forbidden(res, "Only the on-chain issuer may index this credential");
    }

    const credential = await Credential.create({
      credentialHash, issuerDID, subjectDID, issuerAddress: req.user.address, type,
      ipfsCid, expiresAt: expiresAt ? new Date(expiresAt * 1000) : undefined,
      txHash, status: "valid",
    });

    res.status(201).json({ success: true, credential });
  } catch (err) {
    next(err);
  }
};

// GET /api/credentials/:credentialHash/verify   (public)
// Checks the credential's status directly against the blockchain. MongoDB is only used to retrieve additional information.
// The blockchain registry is the source of truth for whether the credential has been registered or revoked.
exports.verifyCredential = async (req, res, next) => {
  try {
    const { credentialHash } = req.params;

    const [record, indexed] = await Promise.all([
      blockchainService.getCredentialRecord(credentialHash),
      Credential.findOne({ credentialHash }),
    ]);

    let valid = false;
    let reason = "not registered";
    if (record.issued) {
      valid = !record.revoked;
      reason = record.revoked ? "revoked" : "valid";
    }

    res.json({ success: true, valid, reason, record, metadata: indexed });
  } catch (err) {
    next(err);
  }
};

// POST /api/credentials/verify   { vc }   (public)
// Checks a credential presented by its holder. This is the main verification process used by relying parties. 
// No login or access to the encrypted IPFS document is needed because the holder provides the credential directly.
// The server checks that:
//   1. The issuer's signature is valid and matches the issuer DID.
//   2. The credential hash is registered on the blockchain.
//   3. The registered issuer matches the signing wallet.
//   4. The credential has not been revoked or expired.
exports.verifyPresentedCredential = async (req, res, next) => {
  try {
    const { vc } = req.body;
    const proof = credentialService.verifyProof(vc);
    const checks = {
      proofPresent: proof.hasProof,
      proofValid: proof.proofValid,
      registeredOnChain: false,
      issuerMatchesChain: false,
      notRevoked: false,
      notExpired: !vc.expirationDate || new Date(vc.expirationDate) > new Date(),
    };

    let record = null;
    if (proof.proofValid) {
      record = await blockchainService.getCredentialRecord(proof.credentialHash);
      checks.registeredOnChain = record.issued;
      checks.issuerMatchesChain = record.issued && record.issuer.toLowerCase() === proof.signer;
      checks.notRevoked = record.issued && !record.revoked;
    }

    const valid = Object.values(checks).every(Boolean);
    const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
    res.json({ success: true, valid, reason: valid ? "valid" : `failed: ${failed.join(", ")}`, checks, credentialHash: proof.credentialHash, record });
  } catch (err) {
    next(err);
  }
};

// GET /api/credentials/:credentialHash/document   (auth required)
// Retrieves and decrypts a credential stored on IPFS. Only the issuer or the person the credential belongs to can access its contents. 
// Other verifiers should receive the credential directly from its holder and use POST /verify.
// Retrieving the document does not automatically verify it.
exports.getCredentialDocument = async (req, res, next) => {
  try {
    const { credentialHash } = req.params;

    const indexed = await Credential.findOne({ credentialHash });
    if (!indexed) {
      return res.status(404).json({ success: false, message: "No indexed metadata for this credentialHash" });
    }

    const isIssuer = indexed.issuerAddress === req.user.address;
    const isSubject = addressFromDID(indexed.subjectDID) === req.user.address;
    if (!isIssuer && !isSubject) {
      return forbidden(res, "Only the credential's issuer or subject may read its contents");
    }

    const vc = await fetchDecryptedJSON(indexed.ipfsCid);
    res.json({ success: true, vc, ipfsCid: indexed.ipfsCid });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/credentials/:credentialHash/revoke   (auth required)
// Updates the MongoDB record after a credential has been revoked on the blockchain. 
// The database is only updated after revocation is confirmed.
exports.markRevoked = async (req, res, next) => {
  try {
    const { credentialHash } = req.params;
    const record = await blockchainService.getCredentialRecord(credentialHash);
    if (!record.revoked) {
      return res.status(409).json({ success: false, message: "Credential is not revoked on-chain" });
    }
    const credential = await Credential.findOneAndUpdate({ credentialHash }, { status: "revoked" }, { new: true });
    res.json({ success: true, credential });
  } catch (err) {
    next(err);
  }
};

// GET /api/credentials?subjectDID=...&issuerDID=...   (auth required)
// Returns credentials issued by or received by the logged in user.
exports.listCredentials = async (req, res, next) => {
  try {
    const { subjectDID, issuerDID } = req.query;
    const me = req.user.address;
    const filter = { $or: [{ issuerAddress: me }, { subjectDID: { $regex: `${me}$`, $options: "i" } }] };
    if (subjectDID) filter.subjectDID = subjectDID;
    if (issuerDID) filter.issuerDID = issuerDID;

    const credentials = await Credential.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: credentials.length, credentials });
  } catch (err) {
    next(err);
  }
};
