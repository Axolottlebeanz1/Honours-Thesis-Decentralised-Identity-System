// Creates a did:ethr identifier using the connected wallet address.
export function buildDID(address) {
  return `did:ethr:${address.toLowerCase()}`;
}

export function shortAddress(address = "") {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";
}

export function shortDID(did = "") {
  const id = did.split(":").pop() || "";
  return shortAddress(id);
}

export function buildDIDDocument(did, address) {
  return {
    "@context": "https://www.w3.org/ns/did/v1",
    id: did,
    controller: did,
    verificationMethod: [
      {
        id: `${did}#keys-1`,
        type: "EcdsaSecp256k1RecoveryMethod2020",
        controller: did,
        blockchainAccountId: `eip155:31337:${address}`,
      },
    ],
    authentication: [`${did}#keys-1`],
  };
}
