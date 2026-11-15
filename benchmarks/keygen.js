// Benchmarks wallet key generation and common cryptographic operations.

// Run:  node benchmarks/keygen.js        (env: BENCH_N, default 200)
// Only backend dependencies are needed. No blockchain, IPFS or MongoDB connection is required.
const path = require("path");
const crypto = require("crypto");
const BACKEND = path.join(__dirname, "..", "backend");
const breq = (m) => require(require.resolve(m, { paths: [BACKEND, __dirname] }));
const { Wallet, HDNodeWallet, Mnemonic, hexlify, randomBytes, verifyMessage } = breq("ethers");
const { Recorder } = require("./lib/recorder");

const N = Number(process.env.BENCH_N || 200);
const WARMUP = 20;

// Measures a synchronous function without adding async overhead.
// This is useful for operations that take only a few microseconds.
function timeSync(rec, name, fn, note = "") {
  const t0 = process.hrtime.bigint();
  const out = fn();
  rec.sample(name, Number(process.hrtime.bigint() - t0) / 1e6, "ms", note);
  return out;
}

async function timeAsync(rec, name, fn, note = "") {
  const t0 = process.hrtime.bigint();
  const out = await fn();
  rec.sample(name, Number(process.hrtime.bigint() - t0) / 1e6, "ms", note);
  return out;
}

async function main() {
  const rec = new Recorder("keygen", { N, warmup: WARMUP, library: "ethers.js (proxy for MetaMask key handling)" });
  console.log(`Key-generation benchmark, N=${N} (+${WARMUP} warm-up, discarded)`);

  // Run a short warm-up first so the initial setup and JIT overhead do not affect the recorded measurements.
  for (let i = 0; i < WARMUP; i++) {
    new Wallet(hexlify(randomBytes(32)));
    Wallet.createRandom();
    crypto.randomBytes(32);
  }
  const warmWallet = Wallet.createRandom();
  for (let i = 0; i < WARMUP; i++) {
    const s = await warmWallet.signMessage("warm");
    verifyMessage("warm", s);
  }

  // ---- 1. Generate a secp256k1 key pair and Ethereum address ----
  // Creates a random private key, derives its public key and calculates the corresponding Ethereum address.
  const rawAddrs = new Set();
  for (let i = 0; i < N; i++) {
    const w = timeSync(rec, "keygen.secp256k1.keypair+address", () => new Wallet(hexlify(randomBytes(32))),
      "private key -> public key -> address");
    rawAddrs.add(w.address);
  }

  // ---- 2. Create a complete HD wallet ----
  // Measures the time needed to generate a BIP-39 recovery phrase, derive the wallet seed using PBKDF2, and create the first
  // Ethereum account using the BIP-44 derivation path.
  const hdAddrs = new Set();
  const phrases = [];
  for (let i = 0; i < N; i++) {
    const w = timeSync(rec, "keygen.hdWallet.createRandom", () => Wallet.createRandom(),
      "BIP-39 mnemonic + PBKDF2-HMAC-SHA512 seed + BIP-44 m/44'/60'/0'/0/0");
    hdAddrs.add(w.address);
    if (phrases.length < 1) phrases.push(w.mnemonic.phrase);
  }

  // ---- 3. Derive additional accounts from an existing wallet ----
  const root = HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(phrases[0]), "m");
  for (let i = 0; i < N; i++) {
    timeSync(rec, "keygen.hdWallet.deriveAccount", () => root.derivePath(`44'/60'/0'/0/${i}`),
      "child key derivation only (no mnemonic/PBKDF2)");
  }

  // ---- 4. Generate AES-256 keys ----
  const aesKeys = new Set();
  for (let i = 0; i < N; i++) {
    const k = timeSync(rec, "keygen.aes256.key", () => crypto.randomBytes(32), "backend ENCRYPTION_KEY (one-off)");
    aesKeys.add(k.toString("hex"));
  }

  // ---- 5. Measure signing and signature recovery ----
  const signer = Wallet.createRandom();
  const msg = "Sign in to Decentralized Identity System.\nNonce: " + crypto.randomBytes(32).toString("hex");
  let sig;
  for (let i = 0; i < N; i++) {
    sig = await timeAsync(rec, "crypto.ecdsa.sign(personal_sign)", () => signer.signMessage(msg),
      "client-side signing (MetaMask's role)");
  }
  for (let i = 0; i < N; i++) {
    timeSync(rec, "crypto.ecdsa.recover(verifyMessage)", () => verifyMessage(msg, sig),
      "server-side signer recovery, no HTTP");
  }

  // Check that the generated keys and addresses are unique, the private key has the expected size, and signature recovery works.
  const pk = new Wallet(hexlify(randomBytes(32)));
  rec.check("K1", "keygen", `${N} raw secp256k1 key pairs yield ${N} distinct addresses`, `${N} distinct`, `${rawAddrs.size} distinct`, rawAddrs.size === N);
  rec.check("K2", "keygen", `${N} HD wallets yield ${N} distinct addresses`, `${N} distinct`, `${hdAddrs.size} distinct`, hdAddrs.size === N);
  rec.check("K3", "keygen", `${N} AES-256 keys are all distinct and 32 bytes`, `${N} distinct`, `${aesKeys.size} distinct`, aesKeys.size === N && [...aesKeys].every((k) => k.length === 64));
  rec.check("K4", "keygen", "private key is 256-bit (32 bytes)", "32 bytes", `${(pk.privateKey.length - 2) / 2} bytes`, (pk.privateKey.length - 2) / 2 === 32);
  rec.check("K5", "keygen", "signature recovers to the signing address", "match", verifyMessage(msg, sig) === signer.address ? "match" : "mismatch", verifyMessage(msg, sig) === signer.address);

  rec.save();
  if (rec.checks.some((c) => !c.pass)) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
