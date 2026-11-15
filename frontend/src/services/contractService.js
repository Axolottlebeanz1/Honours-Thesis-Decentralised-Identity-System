// Keeps the contract calls separate from the React components, making them easier to test on their own.
// Every write is signed using the connected wallet. The backend does not hold a key that can register or revoke records for users.

export async function registerDIDOnChain(didRegistry, signer, did, docCID) {
  const contract = didRegistry.connect(signer);
  const tx = await contract.registerDID(did, docCID);
  const receipt = await tx.wait();
  return receipt.hash;
}

export async function updateDIDOnChain(didRegistry, signer, newDocCID) {
  const contract = didRegistry.connect(signer);
  const tx = await contract.updateDID(newDocCID);
  const receipt = await tx.wait();
  return receipt.hash;
}

// Registers a credential hash on chain.
// The issuer must already have an active DID, which CredentialRegistry checks using DIDRegistry.hasActiveDID().
export async function registerCredentialOnChain(credentialRegistry, signer, credentialHash) {
  const contract = credentialRegistry.connect(signer);
  const tx = await contract.registerCredential(credentialHash);
  const receipt = await tx.wait();
  return receipt.hash;
}

export async function revokeCredentialOnChain(credentialRegistry, signer, credentialHash) {
  const contract = credentialRegistry.connect(signer);
  const tx = await contract.revokeCredential(credentialHash);
  const receipt = await tx.wait();
  return receipt.hash;
}
