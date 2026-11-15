import { Link, useSearchParams } from "react-router-dom";
import { useWallet } from "../hooks/useWallet";

export default function Home() {
  const { isConnected, isAuthenticated, connect, signIn, authenticating } = useWallet();
  const [params] = useSearchParams();
  const promptConnect = params.get("connect") === "1";

  return (
    <div className="page-container">
      <div className="page-header">
        <span className="eyebrow">did:ethr · verifiable credentials · on-chain trust</span>
        <h1 style={{ fontSize: "2.2rem", maxWidth: 620 }}>
          One identity, sealed on chain. Owned by no one but you.
        </h1>
        <p style={{ maxWidth: 560 }}>
          Register a decentralised identifier, ask an issuer to seal a verifiable
          credential against it, and let anyone verify that seal, without ever
          asking a central server to vouch for you.
        </p>

        {promptConnect && !isAuthenticated && (
          <div className="alert alert-error">
            {isConnected ? "Sign the message request to continue to that page." : "Connect your wallet to continue to that page."}
          </div>
        )}

        {!isConnected && (
          <button className="btn btn-primary" onClick={connect}>Connect wallet to begin</button>
        )}
        {isConnected && !isAuthenticated && (
          <button className="btn btn-primary" onClick={signIn} disabled={authenticating}>
            {authenticating ? "Check your wallet…" : "Sign in to continue"}
          </button>
        )}
        {isAuthenticated && (
          <Link to="/create-did" className="btn btn-primary">Create your DID</Link>
        )}
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="seal" style={{ marginBottom: "0.8rem" }}>01</div>
          <h3>Register a DID</h3>
          <p>Your wallet becomes the controller of a did:ethr identifier, anchored in DIDRegistry.sol.</p>
          <Link to="/create-did">Create DID →</Link>
        </div>
        <div className="card">
          <div className="seal" style={{ marginBottom: "0.8rem" }}>02</div>
          <h3>Issue a credential</h3>
          <p>Issuers seal a Verifiable Credential's hash on chain via CredentialRegistry.sol.</p>
          <Link to="/issue">Issue credential →</Link>
        </div>
        <div className="card">
          <div className="seal" style={{ marginBottom: "0.8rem" }}>03</div>
          <h3>Verify a seal</h3>
          <p>Anyone can check issuance, expiry and revocation status directly against the chain.</p>
          <Link to="/verify">Verify credential →</Link>
        </div>
      </div>
    </div>
  );
}
