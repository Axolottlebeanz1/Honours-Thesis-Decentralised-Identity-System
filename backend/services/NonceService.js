const crypto = require("crypto");

// Generates and manages one-time login nonces.
// Each nonce is a random 32-byte value created with crypto.randomBytes().
// It is stored on the server and removed after use to prevent the same signature from being submitted more than once.
class NonceService {
  constructor() {
    this._store = new Map(); // address (lowercase) -> { nonce, expiresAt }
    this.ttlMs = 5 * 60 * 1000; // 5 minute expiry window
  }

  // Creates a new nonce for an address, overwriting any previous unused one.
  issue(address) {
    const nonce = crypto.randomBytes(32).toString("hex");
    this._store.set(address.toLowerCase(), { nonce, expiresAt: Date.now() + this.ttlMs });
    return nonce;
  }

  // Returns the current nonce for an address, or null if no valid nonce/expired.
  peek(address) {
    const entry = this._store.get(address.toLowerCase());
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this._store.delete(address.toLowerCase());
      return null;
    }
    return entry.nonce;
  }

  // Retrieves and removes the nonce in one operation. Once consumed, it cannot be used again for another login attempt.
  consume(address) {
    const nonce = this.peek(address);
    if (nonce) this._store.delete(address.toLowerCase());
    return nonce;
  }
}

module.exports = new NonceService();
