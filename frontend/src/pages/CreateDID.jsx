import { useState } from "react";
import { useContracts } from "../hooks/useContract";
import { useWallet } from "../hooks/useWallet";
import { api } from "../services/api";
import { registerDIDOnChain } from "../services/contractService";
import { buildDID, buildDIDDocument } from "../utils/did";
import { friendlyTxError } from "../utils/errors";

const STEPS = ["Encrypting & pinning document", "Sign on-chain tx", "Confirm & index"];

export default function CreateDID() {
  const { account, provider, isAuthenticated } = useWallet();
  const { didRegistry } = useContracts();
  const [displayName, setDisplayName] = useState("");
  const [step, setStep] = useState(-1);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    try {
      const did = buildDID(account);
      const didDocument = buildDIDDocument(did, account);

      setStep(0);
      // Encrypts the DID Document with AES-256-GCM and uploads it to IPFS.
      // The backend returns the CID, which is used when registering the DID on chain.
      const { docCID } = await api.prepareDID(did, didDocument);

      setStep(1);
      const signer = await provider.getSigner();
      const txHash = await registerDIDOnChain(didRegistry, signer, did, docCID);

      setStep(2);
      // DIDRegistry stores each record under the wallet address, so the confirmation request uses the address rather than the DID string.
      const { profile } = await api.confirmDID(account, { did, txHash, docCID, displayName });

      setResult(profile);
      setStep(3);
    } catch (err) {
      setError(friendlyTxError(err));
      setStep(-1);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <span className="eyebrow">step 1 of 3</span>
        <h1>Create your DID</h1>
        <p>
          This mints a did:ethr identifier controlled by your connected wallet address.
          Your DID Document is AES-256-GCM encrypted before it ever leaves the backend for IPFS.
        </p>
      </div>

      {!account && <div className="alert alert-error">Connect your wallet first.</div>}
      {error && <div className="alert alert-error">{error}</div>}
      {result && (
        <div className="alert alert-success">
          DID registered: <span className="mono">{result.did}</span>
        </div>
      )}

      <form className="card" onSubmit={handleSubmit}>
        <div className="field">
          <label>Display name (optional)</label>
          <input
            type="text" placeholder="e.g. Jordan's Research Identity"
            value={displayName} onChange={(e) => setDisplayName(e.target.value)}
          />
          <span className="hint">Stored off-chain only, for your dashboard — never affects the DID itself.</span>
        </div>

        <div className="field">
          <label>Your wallet address</label>
          <input value={account || "Not connected"} disabled />
          <span className="hint">DIDRegistry stores one DID per address — this is the key your record resolves under.</span>
        </div>

        <button className="btn btn-primary" type="submit" disabled={!isAuthenticated || (step >= 0 && step < 3)}>
          {step >= 0 && step < 3 ? <span className="spinner" /> : null}
          {!isAuthenticated ? "Sign in first (see top right)" : step === -1 ? "Register DID" : step < 3 ? STEPS[step] : "Done"}
        </button>
      </form>
    </div>
  );
}
