import { useState } from "react";
import { runAccessControlSuite } from "../services/accessControlDemo";

export default function Security() {
  const [results, setResults] = useState([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const run = async () => {
    setRunning(true); setError(null); setResults([]); setDone(false);
    try {
      await runAccessControlSuite(setResults);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  const passed = results.filter((r) => r.passed).length;

  return (
    <div className="page-container">
      <div className="page-header">
        <span className="eyebrow">access control</span>
        <h1>Live security checks</h1>
        <p>
          Runs the DIDRegistry access-control scenarios against the deployed contract. 
          Each row is an attack attempt and the contract's actual response. 
          The chain is rolled back afterwards, so your real DIDs are not affected.
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {done && (
        <div className={`alert ${passed === results.length ? "alert-success" : "alert-error"}`}>
          {passed}/{results.length} checks passed
          {passed === results.length && " — every illegitimate action was blocked by the contract."}
        </div>
      )}

      <div className="card">
        <button className="btn btn-primary" onClick={run} disabled={running}>
          {running ? <span className="spinner" /> : null}
          {running ? "Running checks…" : results.length ? "Run again" : "Run security checks"}
        </button>
      </div>

      {results.map((r) => (
        <div className="card ac-row" key={r.id}>
          <div className="ac-head">
            <strong>{r.id}. {r.title}</strong>
            <span className={`status-pill ${r.passed ? "valid" : "revoked"}`}>{r.passed ? "blocked" : "FAILED"}</span>
          </div>
          <dl className="ac-detail">
            <dt>Caller</dt><dd>{r.actor}</dd>
            <dt>Attempt</dt><dd className="mono">{r.call}</dd>
            <dt>Expected</dt><dd>{r.expected}</dd>
            <dt>Contract said</dt><dd className="mono">{r.actual}</dd>
          </dl>
        </div>
      ))}
    </div>
  );
}
