import { useState } from "react";
import { shortAddress } from "../utils/did";
import { api } from "../services/api";

export default function DIDCard({ did, controller, active, docCID, createdAt }) {
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleViewDocument = async () => {
    setError(null);
    if (document) {
      setDocument(null);
      return;
    }
    setLoading(true);
    try {
      const data = await api.getDIDDocument(controller);
      setDocument(data.didDocument);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ display: "flex", gap: "1rem" }}>
      <div className={`seal ${active ? "" : "revoked"}`}>{(did || "").slice(-2).toUpperCase()}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
          <span className="hash-chip">{did}</span>
          <span className={`status-pill ${active ? "valid" : "revoked"}`}>{active ? "active" : "deactivated"}</span>
        </div>
        <p style={{ marginTop: "0.6rem", marginBottom: "0.2rem" }}>
          Owner address: <span className="mono">{shortAddress(controller)}</span>
        </p>
        {docCID && <p style={{ margin: 0 }}>Encrypted document CID: <span className="mono">{docCID}</span></p>}
        {createdAt && <p style={{ margin: 0 }}>Registered: {createdAt}</p>}

        {docCID && (
          <button className="btn btn-secondary" style={{ marginTop: "0.6rem" }} onClick={handleViewDocument} disabled={loading}>
            {loading ? <span className="spinner" /> : null}
            {loading ? "Decrypting…" : document ? "Hide document" : "View document"}
          </button>
        )}
        {error && <div className="alert alert-error" style={{ marginTop: "0.6rem" }}>{error}</div>}
        {document && (
          <pre className="hash-chip" style={{ marginTop: "0.6rem", whiteSpace: "pre-wrap", wordBreak: "break-word", padding: "0.8rem" }}>
            {JSON.stringify(document, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
