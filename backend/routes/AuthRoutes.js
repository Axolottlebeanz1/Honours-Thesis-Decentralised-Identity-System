const express = require("express");
const jwt = require("jsonwebtoken");
const config = require("../config");
const nonceService = require("../services/NonceService");
const { buildAuthMessage, verifySignedNonce } = require("../services/SignatureService");

const router = express.Router();

// GET /api/auth/nonce/:address
// Generates a new random 32-byte nonce for the wallet to sign.
// If another nonce is requested before verification, the previous one is replaced.
// Only the latest nonce can be used to log in. 
router.get("/nonce/:address", (req, res) => {
  const { address } = req.params;
  const nonce = nonceService.issue(address);
  res.json({ success: true, message: buildAuthMessage(nonce) });
});

// POST /api/auth/verify  { address, signature }
// Checks the wallet signature using the nonce issued earlier.
// The nonce is removed when used, so it cannot be submitted again. This prevents the same login signature from being reused.
router.post("/verify", (req, res) => {
  const { address, signature } = req.body;
  if (!address || !signature) {
    return res.status(400).json({ success: false, message: "address and signature are required" });
  }

  const nonce = nonceService.consume(address);
  if (!nonce) {
    return res.status(400).json({ success: false, message: "No active nonce for this address (expired, already used, or never issued)" });
  }

  const isValid = verifySignedNonce({ address, nonce, signature });
  if (!isValid) {
    return res.status(401).json({ success: false, message: "Signature verification failed" });
  }

  const token = jwt.sign({ address: address.toLowerCase() }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
  res.json({ success: true, token });
});

module.exports = router;
