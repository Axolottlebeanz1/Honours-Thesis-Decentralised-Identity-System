import { useState } from "react";
import { getBytes } from "ethers";
import { useContracts } from "../hooks/useContract";
import { useWallet } from "../hooks/useWallet";
import { api } from "../services/api";
import { registerCredentialOnChain } from "../services/contractService";
import { friendlyTxError } from "../utils/errors";

export default function IssueCredential() {
  const { account, provider, isAuthenticated } = useWallet();
  const { credentialRegistry } = useContracts();

  const [form, setForm] = useState({
    issuerDID: "", subjectDID: "", credentialType: "ProofOfCompletion", claims: '{\n  "course": "Applied Cryptography"\n}',
  });
  const [step, setStep] = useState(-1);
  const [txHash, setTxHash] = useState(null);
  const [credentialHash, setCredentialHash] = useState(null);
  const [signedVC, setSignedVC] = useState(null);
  const [error, setError] = useState(null);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setTxHash(null);
    setCredentialHash(null);
    setSignedVC(null);

    let credentialSubject;
    try {
      credentialSubject = JSON.parse(form.claims);
    } catch {
      setError("Claims must be valid JSON.");
      return;
    }

    try {
      setStep(0);
      // 1. The backend creates the unsigned Verifiable Credential and calculates its hash.
      const prepared = await api.prepareCredential({
        issuerDID: form.issuerDID,
        subjectDID: form.subjectDID,
        type: [form.credentialType],
        credentialSubject,
      });

      setStep(1);
      // 2. The issuer signs the 32-byte credential hash using their wallet.
      const signer = await provider.getSigner();
      const signature = await signer.signMessage(getBytes(prepared.credentialHash));

      setStep(2);
      // 3. The backend verifies the signature, adds it to the credential as proof, then encrypts the signed credential and uploads it to IPFS.
      const issued = await api.issueCredential(prepared.vc, signature);

      setStep(3);
      // 4. Only the credential hash is registered on chain. The claims are not stored there.
      const hash = await registerCredentialOnChain(credentialRegistry, signer, issued.credentialHash);

      setStep(4);
      // 5. The backend saves the credential's non-sensitive details for later lookup.
      await api.confirmCredential({
        credentialHash: issued.credentialHash,
        issuerDID: form.issuerDID,
        subjectDID: form.subjectDID,
        type: ["VerifiableCredential", form.credentialType],
        ipfsCid: issued.ipfsCid,
        txHash: hash,
      });

      setSignedVC(issued.vc);
      setTxHash(hash);
      setCredentialHash(issued.credentialHash);
      setStep(5);
    } catch (err) {
      setError(friendlyTxError(err));
      setStep(-1);
    }
  };

  const stepLabel = ["Building credential…", "Sign the credential in your wallet…", "Encrypting & pinning to IPFS…", "Confirm the transaction in your wallet…", "Indexing credential…"];

  return (
    <div className="page-container">
      <div className="page-header">
        <span className="eyebrow">issuer flow</span>
        <h1>Issue a credential</h1>
        <p>
          You must hold an active DID for the on chain transaction to succeed.
          CredentialRegistry checks this against DIDRegistry before accepting the write.
          The credential is signed by your wallet; only its hash is ever recorded on chain.
        </p>
      </div>

      {!account && <div className="alert alert-error">Connect your wallet first.</div>}
      {error && <div className="alert alert-error">{error}</div>}
      {txHash && (
        <div className="alert alert-success">
          Credential hash registered on-chain. Tx: <span className="mono">{txHash}</span>
          <br />Credential hash: <span className="mono">{credentialHash}</span>
        </div>
      )}
      {signedVC && (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <p style={{ marginBottom: "0.6rem" }}>
            Signed credential. Give this JSON to the holder: they present it to relying parties, who verify
            the issuer signature and on chain status without needing access to this system's storage.
          </p>
          <pre className="hash-chip" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", padding: "0.8rem" }}>
            {JSON.stringify(signedVC, null, 2)}
          </pre>
        </div>
      )}

      <form className="card" onSubmit={handleSubmit}>
        <div className="field">
          <label>Issuer DID</label>
          <input placeholder="did:ethr:0xabc..." value={form.issuerDID} onChange={update("issuerDID")} required />
          <span className="hint">Must resolve to your connected wallet address's registered DID.</span>
        </div>
        <div className="field">
          <label>Subject DID</label>
          <input placeholder="did:ethr:0xdef..." value={form.subjectDID} onChange={update("subjectDID")} required />
        </div>
        <div className="field">
          <label>Credential type</label>
          <input value={form.credentialType} onChange={update("credentialType")} required />
        </div>
        <div className="field">
          <label>Claims (JSON)</label>
          <textarea rows={6} className="mono" value={form.claims} onChange={update("claims")} />
        </div>

        <button className="btn btn-primary" type="submit" disabled={!isAuthenticated || (step >= 0 && step < 5)}>
          {step >= 0 && step < 5 ? <span className="spinner" /> : null}
          {!isAuthenticated ? "Sign in first (see top right)" : step === -1 ? "Issue credential" : step < 5 ? stepLabel[step] : "Issued"}
        </button>
      </form>
    </div>
  );
}
