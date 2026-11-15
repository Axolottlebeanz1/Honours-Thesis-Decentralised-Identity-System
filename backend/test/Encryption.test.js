const crypto = require("crypto");
process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
const config = require("../config");
const { encryptJSON, decryptJSON } = require("../utils/encryption");

describe("AES-256-GCM envelope encryption", () => {
  const doc = { id: "did:ethr:0xabc", note: "secret" };

  it("round-trips an object", () => {
    expect(decryptJSON(encryptJSON(doc))).toEqual(doc);
  });

  it("emits { alg, iv, ciphertext, tag } and hides the plaintext", () => {
    const env = encryptJSON(doc);
    expect(Object.keys(env).sort()).toEqual(["alg", "ciphertext", "iv", "tag"]);
    expect(JSON.stringify(env)).not.toContain("did:ethr");
  });

  it("uses a fresh IV, so identical plaintexts give different ciphertexts", () => {
    const a = encryptJSON(doc), b = encryptJSON(doc);
    expect(a.iv).not.toEqual(b.iv);
    expect(a.ciphertext).not.toEqual(b.ciphertext);
  });

  it.each(["ciphertext", "iv", "tag"])("rejects a modified %s", (field) => {
    const env = encryptJSON(doc);
    const buf = Buffer.from(env[field], "hex");
    buf[0] ^= 0x01;
    expect(() => decryptJSON({ ...env, [field]: buf.toString("hex") })).toThrow();
  });

  it("rejects decryption under a different key", () => {
    const env = encryptJSON(doc);
    const saved = config.encryptionKey;
    config.encryptionKey = crypto.randomBytes(32).toString("hex");
    try { expect(() => decryptJSON(env)).toThrow(); } finally { config.encryptionKey = saved; }
  });

  it("rejects legacy / unknown-algorithm envelopes", () => {
    expect(() => decryptJSON({ iv: "00", ciphertext: "00" })).toThrow(/algorithm/);
  });
});
