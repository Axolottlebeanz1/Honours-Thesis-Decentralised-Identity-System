// Converts ethers and JSON-RPC errors into messages that are easier to understand.
export function friendlyTxError(err) {
  const raw = [err?.message, err?.shortMessage, err?.info?.error?.message, err?.error?.message]
    .filter(Boolean)
    .join(" ");

  if (/nonce too (high|low)/i.test(raw)) {
    return (
      "Your wallet's transaction count is out of sync with the local chain (this happens after " +
      "restarting `hardhat node`). In MetaMask go to Settings → Developer Tools → Delete activity and nonce data, then try again."
    );
  }
  if (/user rejected|ACTION_REJECTED/i.test(raw)) {
    return "You rejected the transaction in your wallet.";
  }
  if (/already registered|DIDAlreadyRegistered/i.test(raw)) {
    return "This wallet address already has a DID registered.";
  }
  // Use a short, readable error message if no specific case matches.
  return err?.shortMessage || err?.message || "Transaction failed";
}
