const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

function authHeaders() {
  const token = localStorage.getItem("idsys_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...options.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    // If the session token is missing, expired or invalid, remove it.
    localStorage.removeItem("idsys_token");
    localStorage.removeItem("idsys_token_address");
  }
  if (!res.ok) throw new Error(data.message || `Request failed: ${res.status}`);
  return data;
}

export const api = {
  // Authentication: request a nonce, sign it with the wallet, then verify the signature.
  getNonce: (address) => request(`/auth/nonce/${address}`),
  verifySignature: (address, signature) =>
    request("/auth/verify", { method: "POST", body: JSON.stringify({ address, signature }) }),

  // DIDs are looked up by wallet address, matching the way DIDRegistry stores records.
  prepareDID: (did, didDocument) =>
    request("/did", { method: "POST", body: JSON.stringify({ did, didDocument }) }),
  confirmDID: (address, payload) =>
    request(`/did/${address}/confirm`, { method: "PATCH", body: JSON.stringify(payload) }),
  resolveDID: (address) => request(`/did/${address}`),
  listDIDs: (owner) => request(`/did${owner ? `?owner=${owner}` : ""}`),
  // Fetches the full DID Document from IPFS and decrypts it, returning the document and not just its CID.
  getDIDDocument: (address) => request(`/did/${address}/document`),

  // Credentials are identified by their hash. The claims are stored in the encrypted IPFS document rather than in the database.
  prepareCredential: (payload) =>
    request("/credentials/prepare", { method: "POST", body: JSON.stringify(payload) }),
  issueCredential: (vc, signature) =>
    request("/credentials/issue", { method: "POST", body: JSON.stringify({ vc, signature }) }),
  verifyPresentedCredential: (vc) =>
    request("/credentials/verify", { method: "POST", body: JSON.stringify({ vc }) }),
  confirmCredential: (payload) =>
    request("/credentials/confirm", { method: "POST", body: JSON.stringify(payload) }),
  verifyCredential: (credentialHash) => request(`/credentials/${credentialHash}/verify`),
  // Fetches the full Verifiable Credential from IPFS and decrypts it.
  getCredentialDocument: (credentialHash) => request(`/credentials/${credentialHash}/document`),
  listCredentials: (params = {}) =>
    request(`/credentials?${new URLSearchParams(params).toString()}`),
  revokeCredential: (credentialHash, txHash) =>
    request(`/credentials/${credentialHash}/revoke`, { method: "PATCH", body: JSON.stringify({ txHash }) }),
};
