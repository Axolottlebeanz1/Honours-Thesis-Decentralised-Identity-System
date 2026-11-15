import { useWallet } from "../hooks/useWallet";
import { shortAddress } from "../utils/did";

export default function WalletConnectButton() {
  const {
    isConnected, isAuthenticated, account, connect, disconnect,
    connecting, authenticating, signIn, isWrongNetwork, expectedChain,
  } = useWallet();

  if (isWrongNetwork) {
    return <button className="btn btn-danger" disabled>Wrong network — switch to {expectedChain.name}</button>;
  }

  if (isConnected && !isAuthenticated) {
    // The wallet is connected, but the user still needs to sign in.
    // Requests to protected endpoints will fail until a valid session is created.
    return (
      <button className="btn btn-primary" onClick={signIn} disabled={authenticating}>
        {authenticating ? <span className="spinner" /> : null}
        {authenticating ? "Check your wallet…" : "Sign in to continue"}
      </button>
    );
  }

  if (isAuthenticated) {
    return (
      <button className="btn btn-secondary" onClick={disconnect} title={account}>
        <span className="status-pill valid" style={{ padding: "0.15rem 0.5rem" }}>connected</span>
        {shortAddress(account)}
      </button>
    );
  }

  return (
    <button className="btn btn-primary" onClick={connect} disabled={connecting}>
      {connecting ? <span className="spinner" /> : null}
      {connecting ? "Connecting…" : "Connect wallet"}
    </button>
  );
}
