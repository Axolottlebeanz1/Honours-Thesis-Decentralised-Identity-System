import { useEffect, useState } from "react";
import { useWallet } from "../hooks/useWallet";
import { useContracts } from "../hooks/useContract";
import { api } from "../services/api";
import { revokeCredentialOnChain } from "../services/contractService";
import DIDCard from "../components/DIDCard.jsx";
import CredentialCard from "../components/CredentialCard.jsx";
import { friendlyTxError } from "../utils/errors";

export default function Dashboard() {
  const { account, provider } = useWallet();
  const { credentialRegistry } = useContracts();
  const [dids, setDids] = useState([]);
  const [issued, setIssued] = useState([]);     // credentials this wallet issued (can revoke)
  const [received, setReceived] = useState([]); // credentials issued to this wallet's DID
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [revokingHash, setRevokingHash] = useState(null);
  const [revokeError, setRevokeError] = useState(null);
  const [revokeNotice, setRevokeNotice] = useState(null);

  useEffect(() => {
    if (!account) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const me = account.toLowerCase();
        const [didList, credList] = await Promise.all([api.listDIDs(account), api.listCredentials()]);
        if (!cancelled) {
          setDids(didList.profiles);
          setIssued(credList.credentials.filter((c) => (c.issuerAddress || "").toLowerCase() === me));
          setReceived(credList.credentials.filter((c) => (c.subjectDID || "").toLowerCase().endsWith(me)));
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [account]);

  // Revoking a credential requires a transaction signed by the issuer.
  // The backend is updated only after the transaction is confirmed and the on chain record has been checked.
  const handleRevoke = async (credentialHash) => {
    if (!window.confirm("Revoke this credential? This is permanent and sends an on-chain transaction.")) return;
    setRevokeError(null);
    setRevokeNotice(null);
    setRevokingHash(credentialHash);
    try {
      const signer = await provider.getSigner();
      const txHash = await revokeCredentialOnChain(credentialRegistry, signer, credentialHash);
      await api.revokeCredential(credentialHash, txHash);

      const markRevoked = (list) => list.map((c) => (c.credentialHash === credentialHash ? { ...c, status: "revoked" } : c));
      setIssued(markRevoked);
      setReceived(markRevoked);
      setRevokeNotice(`Credential revoked on-chain. Tx: ${txHash}`);
    } catch (err) {
      setRevokeError(friendlyTxError(err));
    } finally {
      setRevokingHash(null);
    }
  };

  if (!account) {
    return (
      <div className="page-container">
        <div className="empty-state">Connect your wallet to view your dashboard.</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <span className="eyebrow">your identity</span>
        <h1>Dashboard</h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {revokeError && <div className="alert alert-error">{revokeError}</div>}
      {revokeNotice && <div className="alert alert-success"><span className="mono">{revokeNotice}</span></div>}
      {loading && <div className="empty-state"><span className="spinner" /> Loading your records…</div>}

      {!loading && (
        <>
          <h3 style={{ marginTop: "1.5rem" }}>Your DID</h3>
          {dids.length === 0 ? (
            <div className="empty-state">No DID registered to this wallet yet.</div>
          ) : (
            dids.map((d) => (
              <DIDCard key={d.did} did={d.did} controller={d.controllerAddress} active={d.active} docCID={d.docCID} />
            ))
          )}

          <h3 style={{ marginTop: "2rem" }}>Credentials you issued</h3>
          <p>Only the wallet that issued a credential can revoke it. Revoking is permanent.</p>
          {issued.length === 0 ? (
            <div className="empty-state">You haven't issued any credentials from this wallet yet.</div>
          ) : (
            issued.map((c) => (
              <CredentialCard
                key={c.credentialHash}
                credential={c}
                onRevoke={handleRevoke}
                revoking={revokingHash === c.credentialHash}
              />
            ))
          )}

          <h3 style={{ marginTop: "2rem" }}>Credentials issued to you</h3>
          {received.length === 0 ? (
            <div className="empty-state">No credentials found for this DID yet.</div>
          ) : (
            received.map((c) => <CredentialCard key={c.credentialHash} credential={c} />)
          )}
        </>
      )}
    </div>
  );
}
