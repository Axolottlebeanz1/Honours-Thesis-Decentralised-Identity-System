const { verifyMessage } = require("ethers");

// Handles wallet signature checks during login.
// It recovers the address that signed the authentication message and checks that it matches the address provided by the frontend.
function buildAuthMessage(nonce) {
  return `Sign in to Decentralized Identity System.\nNonce: ${nonce}`;
}

function verifySignedNonce({ address, nonce, signature }) {
  const message = buildAuthMessage(nonce);
  let recovered;
  try {
    recovered = verifyMessage(message, signature);
  } catch (err) {
    return false; // malformed signature
  }
  return recovered.toLowerCase() === address.toLowerCase();
}

module.exports = { buildAuthMessage, verifySignedNonce };
