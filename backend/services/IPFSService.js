const config = require("../config");
const { encryptJSON, decryptJSON } = require("../utils/encryption");

// ipfs-http-client uses ES modules, while this backend uses CommonJS. A dynamic import allows both to work together. 
// The client is only created when IPFS is first needed, so routes and tests that do not use IPFS can still load without an active connection.
let clientPromise = null;
function getClient() {
  if (!clientPromise) {
    clientPromise = import("ipfs-http-client").then(({ create }) => create({ url: config.ipfsApiUrl }));
  }
  return clientPromise;
}

// Encrypts a DID Document or Verifiable Credential using AES-256-GCM before uploading it to IPFS.
// Only the encrypted data, including its algorithm, IV, ciphertext and authentication tag, is stored on IPFS.
// The original data is not uploaded in plaintext.
async function pinEncryptedJSON(obj) {
  const client = await getClient();
  const envelope = encryptJSON(obj);
  const { cid } = await client.add(JSON.stringify(envelope));
  return cid.toString();
}

// Downloads the encrypted file from IPFS using its CID, then decrypts it to restore the original JSON object.
async function fetchDecryptedJSON(cid) {
  const client = await getClient();
  const chunks = [];
  for await (const chunk of client.cat(cid)) chunks.push(chunk);
  const envelope = JSON.parse(Buffer.concat(chunks).toString());
  return decryptJSON(envelope);
}

module.exports = { pinEncryptedJSON, fetchDecryptedJSON };
