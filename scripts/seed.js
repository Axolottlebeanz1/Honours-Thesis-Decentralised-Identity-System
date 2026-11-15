const { ethers } = require("hardhat");

// Creates two demo DIDs and a sample credential, then revokes the credential so the frontend has example records to display.
async function main() {
  const [issuer, subject] = await ethers.getSigners();

  const didRegistryAddress = process.env.DID_REGISTRY_ADDRESS;
  const credentialRegistryAddress = process.env.CREDENTIAL_REGISTRY_ADDRESS;
  if (!didRegistryAddress || !credentialRegistryAddress) {
    throw new Error("Set DID_REGISTRY_ADDRESS and CREDENTIAL_REGISTRY_ADDRESS env vars first");
  }

  const didRegistry = await ethers.getContractAt("DIDRegistry", didRegistryAddress);
  const credentialRegistry = await ethers.getContractAt("CredentialRegistry", credentialRegistryAddress);

  const issuerDID = `did:ethr:${issuer.address.toLowerCase()}`;
  const subjectDID = `did:ethr:${subject.address.toLowerCase()}`;

  // These CIDs are placeholders for encrypted DID Documents.
  // In the normal application flow, the backend encrypts each document, uploads it to IPFS and returns its CID before the on-chain registration.
  await (await didRegistry.connect(issuer).registerDID(issuerDID, "bafy-demo-issuer-doc")).wait();
  await (await didRegistry.connect(subject).registerDID(subjectDID, "bafy-demo-subject-doc")).wait();
  console.log("Registered demo DIDs:", issuerDID, subjectDID);

  // Only the credential hash is stored on chain.
  // In the normal flow, the backend creates the credential and calculates its hash through POST /api/credentials/prepare.
  const credentialHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify({ course: "Applied Cryptography" })));

  await (await credentialRegistry.connect(issuer).registerCredential(credentialHash)).wait();
  console.log("Registered demo credential hash:", credentialHash);
  console.log("isRevoked ->", await credentialRegistry.isRevoked(credentialHash));

  // Revoke the sample credential to demonstrate how the revocation process works.
  await (await credentialRegistry.connect(issuer).revokeCredential(credentialHash)).wait();
  console.log("Revoked demo credential on-chain:", credentialHash);
  console.log("isRevoked ->", await credentialRegistry.isRevoked(credentialHash));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
