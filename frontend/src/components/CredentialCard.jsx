import { useState } from "react";

// Displays a credential and its current status. 
// If the connected wallet issued the credential and it has not been revoked, a Revoke button is also shown. 
// The parent component handles the on chain transaction.
export default function CredentialCard({ credential, onRevoke, revoking = false }) {
  const { credentialHash, type = [], issuerDID, subjectDID, status, issuedAt, expiresAt } = credential;
  const [copied, setCopied] = useState(false);
  const sealClass = status === "revoked" ? "revoked" : "";

  const copyHash = async () => {
    try {
      await navigator.clipboard.writeText(credentialHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // If clipboard access is unavailable, the hash can still be selected and copied manually.
    }
  };

  return (
    <div className="card" style={{ display: "flex", gap: "1rem" }}>
      <div className={`seal ${sealClass}`}>VC</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "0.5rem" }}>
          <strong>{type.filter((t) => t !== "VerifiableCredential").join(", ") || "Verifiable Credential"}</strong>
          <span className={`status-pill ${status === "revoked" ? "revoked" : "valid"}`}>{status}</span>
        </div>
        <p style={{ margin: "0.5rem 0 0.2rem" }}>Issuer: <span className="mono">{issuerDID}</span></p>
        <p style={{ margin: 0 }}>Subject: <span className="mono">{subjectDID}</span></p>
        <p style={{ margin: "0.4rem 0 0" }}>
          Issued {issuedAt ? new Date(issuedAt).toLocaleDateString() : ""}
          {expiresAt ? ` · Expires ${new Date(expiresAt).toLocaleDateString()}` : ""}
        </p>
        <p className="hash-chip" style={{ marginTop: "0.6rem", display: "inline-block" }}>{credentialHash}</p>

        <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.6rem", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-secondary" onClick={copyHash}>
            {copied ? "Copied" : "Copy hash"}
          </button>
          {onRevoke && status !== "revoked" && (
            <button type="button" className="btn btn-danger" onClick={() => onRevoke(credentialHash)} disabled={revoking}>
              {revoking ? <span className="spinner" /> : null}
              {revoking ? "Revoking…" : "Revoke credential"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

