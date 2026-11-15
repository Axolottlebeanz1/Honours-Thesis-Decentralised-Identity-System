const crypto = require("crypto");
const config = require("../config");

// AES-256-GCM provides authenticated encryption. It creates a 128-bit authentication tag. 
// If the ciphertext, IV or tag is changed, decryption fails instead of returning corrupted data.
const ALGORITHM = "aes-256-gcm";
const ALG_LABEL = "aes-256-gcm";
const IV_LENGTH = 12; 
const TAG_LENGTH = 16;

function getKey() {
  const keyHex = config.encryptionKey;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY must be a 32-byte key expressed as 64 hex characters. " +
      "Generate one with: openssl rand -hex 32"
    );
  }
  return Buffer.from(keyHex, "hex");
}

// Encrypts a JSON object using AES-256-GCM and a newly generated random IV. 
// Returns an object containing the algorithm, IV, encrypted data and authentication tag. 
// This encrypted object is what gets stored on IPFS instead of the original document.
function encryptJSON(plainObject) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv, { authTagLength: TAG_LENGTH });
  const plaintext = Buffer.from(JSON.stringify(plainObject), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    alg: ALG_LABEL,
    iv: iv.toString("hex"),
    ciphertext: ciphertext.toString("hex"),
    tag: tag.toString("hex"),
  };
}

// Decrypts an encrypted object created by encryptJSON. It checks the algorithm and required fields before decryption.
// If the data has been changed, the wrong key was used, or the encryption format is unsupported, decryption will fail.
function decryptJSON(envelope) {
  const { alg, iv, ciphertext, tag } = envelope || {};
  if (alg !== ALG_LABEL) throw new Error(`Unsupported or missing envelope algorithm: ${alg}`);
  if (!iv || !ciphertext || !tag) throw new Error("Malformed encryption envelope");

  const ivBuf = Buffer.from(iv, "hex");
  const tagBuf = Buffer.from(tag, "hex");
  if (ivBuf.length !== IV_LENGTH || tagBuf.length !== TAG_LENGTH) throw new Error("Malformed encryption envelope");

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), ivBuf, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tagBuf);
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertext, "hex")), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8"));
}

module.exports = { encryptJSON, decryptJSON };
