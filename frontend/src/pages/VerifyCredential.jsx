import { useState } from "react";
import { api } from "../services/api";

export default function VerifyCredential() {
  const [vcText, setVcText] = useState("");
  const [presented, setPresented] = useState(null);
  const [presentedLoading, setPresentedLoading] = useState(false);

  const [credentialHash, setCredentialHash] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleVerifyPresented = async (e) => {
    e.preventDefault();
    setError(null);
    setPresented(null);
    let vc;
    try {
      vc = JSON.parse(vcText);
    } catch {
      setError("The credential must be valid JSON.");
      return;
    }
    setPresentedLoading(true);
    try {
      setPresented(await api.verifyPresentedCredential(vc));
    } catch (err) {
      setError(err.message);
    } finally {
      setPresentedLoading(false);
    }
  };

  const handleVerifyHash = async (e) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      setResult(await api.verifyCredential(credentialHash));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const labels = {
    proofPresent: "Issuer signature present",
    proofValid: "Signature matches the issuer DID",
    registeredOnChain: "Hash registered on-chain",
    issuerMatchesChain: "On-chain issuer is the signer",
    notRevoked: "Not revoked",
    notExpired: "Not expired",
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <span className="eyebrow">relying-party flow</span>
        <h1>Verify a credential</h1>
        <p>
          Paste the signed credential the holder presents to you. We recompute its hash, check the
          issuer's signature, and read the registry directly on chain. No login or access to the
          encrypted storage is needed.
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <form className="card" onSubmit={handleVerifyPresented} style={{ marginBottom: "1.5rem" }}>
        <div className="field">
          <label>Presented credential (JSON)</label>
          <textarea rows={10} className="mono" placeholder='{ "@context": [...], "issuer": "did:ethr:0x...", "proof": {...} }'
            value={vcText} onChange={(e) => setVcText(e.target.value)} required />
        </div>
        <button className="btn btn-primary" type="submit" disabled={presentedLoading}>
          {presentedLoading ? <span className="spinner" /> : null}
          {presentedLoading ? "Verifying…" : "Verify credential"}
        </button>
      </form>

      {presented && (
        <div className="card" style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
          <div className={`seal ${presented.valid ? "" : "revoked"}`}>{presented.valid ? "OK" : "✕"}</div>
          <div style={{ flex: 1 }}>
            <span className={`status-pill ${presented.valid ? "valid" : "revoked"}`}>
              {presented.valid ? "valid" : "invalid"}
            </span>
            <ul style={{ marginTop: "0.6rem", paddingLeft: "1.1rem" }}>
              {Object.entries(presented.checks).map(([k, ok]) => (
                <li key={k}>{ok ? "✓" : "✕"} {labels[k] || k}</li>
              ))}
            </ul>
            <p className="hash-chip" style={{ marginTop: "0.6rem", display: "inline-block" }}>{presented.credentialHash}</p>
          </div>
        </div>
      )}

      <div className="page-header" style={{ marginTop: "2rem" }}>
        <h2>Check status by hash only</h2>
        <p>Quick on chain status check when you only have the credential hash (no signature check).</p>
      </div>

      <form className="card" onSubmit={handleVerifyHash} style={{ marginBottom: "1.5rem" }}>
        <div className="field">
          <label>Credential hash</label>
          <input className="mono" placeholder="0x..." value={credentialHash}
            onChange={(e) => setCredentialHash(e.target.value)} required />
        </div>
        <button className="btn btn-secondary" type="submit" disabled={loading}>
          {loading ? <span className="spinner" /> : null}
          {loading ? "Checking chain…" : "Check status"}
        </button>
      </form>

      {result && (
        <div className="card" style={{ display: "flex", gap: "1rem" }}>
          <div className={`seal ${result.valid ? "" : "revoked"}`}>{result.valid ? "OK" : "✕"}</div>
          <div style={{ flex: 1 }}>
            <span className={`status-pill ${result.valid ? "valid" : "revoked"}`}>
              {result.valid ? "registered, not revoked" : `invalid, ${result.reason}`}
            </span>
            <p style={{ marginTop: "0.6rem" }}>Issuer address: <span className="mono">{result.record.issuer}</span></p>
            <p>Registered: {result.record.issued ? new Date(result.record.issuedAt * 1000).toLocaleString() : "never"}</p>
            {result.record.revoked && <p>Revoked: {new Date(result.record.revokedAt * 1000).toLocaleString()}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
