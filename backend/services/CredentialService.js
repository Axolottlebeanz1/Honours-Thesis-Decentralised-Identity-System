const canonicalize = require("canonicalize");
const { keccak256, toUtf8Bytes, getBytes, verifyMessage } = require("ethers");

const PROOF_TYPE = "EthereumPersonalSignature2021";

// Extracts the wallet address from a did:ethr identifier. Supports both did:ethr:0xabc... and did:ethr:<network>:0xabc...
// Returns null if the DID does not contain a valid Ethereum address.
function addressFromDID(did) {
  if (typeof did !== "string" || !did.startsWith("did:ethr:")) return null;
  const last = did.split(":").pop();
  return /^0x[a-fA-F0-9]{40}$/.test(last) ? last.toLowerCase() : null;
}

// Handles the creation, hashing and verification of Verifiable Credentials using the W3C Verifiable Credentials Data Model.

// Credential issuance happens in two steps:
// 1. Build the credential without a proof and calculate its hash.
// 2. The issuer signs the hash using their wallet, and the signature is added to the credential as its proof.

// The hash is calculated without the proof field, allowing the verifier to calculate the same hash after the credential has been signed.
class CredentialService {
  // Builds the unsigned credential using the issuer, subject and claim details.
  buildCredential({ issuerDID, subjectDID, type, credentialSubject, expiresAt }) {
    const vc = {
      "@context": ["https://www.w3.org/2018/credentials/v1"],
      type: ["VerifiableCredential", ...type],
      issuer: issuerDID,
      credentialSubject: { id: subjectDID, ...credentialSubject },
      issuanceDate: new Date().toISOString(),
    };
    // Adds an expiry date only when one is provided.
    // This keeps the credential data consistent between the prepare and issue steps, so the calculated hash remains the same.
    if (expiresAt) vc.expirationDate = new Date(expiresAt * 1000).toISOString();
    return vc;
  }

  /// Calculates a Keccak-256 hash of the credential's canonical JSON.
  /// The proof field is excluded so the hash stays the same before and after the issuer adds their signature.
  hashCredential(vc) {
    const { proof, ...unsigned } = vc;
    return keccak256(toUtf8Bytes(canonicalize(unsigned)));
  }

  // Adds the issuer's wallet signature to the credential as its proof.
  attachProof(vc, signature) {
    const { proof, ...unsigned } = vc;
    return {
      ...unsigned,
      proof: {
        type: PROOF_TYPE,
        created: new Date().toISOString(),
        verificationMethod: `${vc.issuer}#keys-1`,
        proofPurpose: "assertionMethod",
        proofValue: signature,
      },
    };
  }

  // Recovers the wallet address that signed the credential hash. Returns null if the signature cannot be verified.
  recoverSigner(credentialHash, signature) {
    try {
      return verifyMessage(getBytes(credentialHash), signature).toLowerCase();
    } catch {
      return null;
    }
  }

  // Checks the signature proof on a credential supplied by the holder. This check can be completed without connecting to the blockchain.
  // It checks that:
  // - The credential contains a proof of the expected type.
  // - The recovered signing address matches the address in the issuer DID.
  verifyProof(vc) {
    const result = { hasProof: false, credentialHash: null, signer: null, issuerAddress: null, proofValid: false };
    if (!vc || typeof vc !== "object") return result;

    result.credentialHash = this.hashCredential(vc);
    result.issuerAddress = addressFromDID(vc.issuer);
    if (!vc.proof || vc.proof.type !== PROOF_TYPE || !vc.proof.proofValue) return result;

    result.hasProof = true;
    result.signer = this.recoverSigner(result.credentialHash, vc.proof.proofValue);
    result.proofValid = Boolean(result.signer && result.issuerAddress && result.signer === result.issuerAddress);
    return result;
  }
}

module.exports = new CredentialService();
module.exports.addressFromDID = addressFromDID;
module.exports.PROOF_TYPE = PROOF_TYPE;
