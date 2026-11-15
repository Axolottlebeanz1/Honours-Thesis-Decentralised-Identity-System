// Tests the IPFS storage process, from encryption and upload through to retrieval and decryption.
// Measures response times, storage overhead, data integrity and whether the stored content remains confidential.
// Requirements: IPFS must be running and the backend dependencies must be installed.
const crypto = require("crypto");
const path = require("path");

// Uses a temporary AES key unless one is already provided.
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString("hex");
const BACKEND = path.join(__dirname, "..", "backend");
const config = require(path.join(BACKEND, "config"));
const { encryptJSON, decryptJSON } = require(path.join(BACKEND, "utils", "encryption"));
const { pinEncryptedJSON, fetchDecryptedJSON } = require(path.join(BACKEND, "services", "ipfs.service"));
const { Recorder } = require("./lib/recorder");

const N = Number(process.env.BENCH_N || 15);
const API = config.ipfsApiUrl.replace(/\/$/, "");

// Sends requests directly to the IPFS API. This allows the benchmark to inspect the data stored by IPFS without going through the application's IPFS service.
async function rpc(pathAndQuery, body) {
  const res = await fetch(`${API}/api/v0/${pathAndQuery}`, { method: "POST", body });
  if (!res.ok) throw new Error(`IPFS RPC ${pathAndQuery} -> ${res.status} ${await res.text()}`);
  return res;
}

async function rawCat(cid) { return Buffer.from(await (await rpc(`cat?arg=${cid}`)).arrayBuffer()); }
async function rawAdd(buf, query = "") {
  const form = new FormData();
  form.append("file", new Blob([buf]));
  const j = await (await rpc(`add?${query}`, form)).json();
  return j.Hash;
}

function sampleDidDocument(address) {
  const did = `did:ethr:${address.toLowerCase()}`;
  return {
    "@context": ["https://www.w3.org/ns/did/v1"],
    id: did,
    verificationMethod: [{ id: `${did}#controller`, type: "EcdsaSecp256k1RecoveryMethod2020", controller: did, blockchainAccountId: `eip155:1337:${address}` }],
    authentication: [`${did}#controller`],
  };

}

function paddedPayload(bytes) {
  const doc = sampleDidDocument("0x" + "ab".repeat(20));
  const overhead = JSON.stringify(doc).length + 30;
  doc.padding = "x".repeat(Math.max(0, bytes - overhead));
  return doc;
}

async function main() {
  const rec = new Recorder("ipfs", { ipfsApi: API, N, cipher: "AES-256-GCM" });
  console.log(`IPFS benchmark against ${API}, N=${N}`);

  // ---- Check that the IPFS node is available ----
  try {
    const id = await (await rpc("id")).json();
    rec.value("ipfs.agent", id.AgentVersion);
    rec.check("I0", "availability", "IPFS node reachable via HTTP API", "reachable", "reachable", true);
  } catch (e) {
    rec.check("I0", "availability", "IPFS node reachable via HTTP API", "reachable", `unreachable: ${e.message}`, false);
    rec.save();
    console.error("\nStart the node first: docker compose up -d");
    process.exit(1);
  }

  // ---- Measure encryption, storage and retrieval for different payload sizes ----
  for (const size of [512, 1024, 10 * 1024, 100 * 1024, 1024 * 1024]) {
    const label = size >= 1024 * 1024 ? "1MB" : size >= 1024 ? `${size / 1024}KB` : `${size}B`;
    const doc = paddedPayload(size);
    const plainBytes = Buffer.byteLength(JSON.stringify(doc));
    rec.value(`size.${label}.plaintextBytes`, plainBytes, "bytes");
    const envBytes = Buffer.byteLength(JSON.stringify(encryptJSON(doc)));
    rec.value(`size.${label}.envelopeBytes`, envBytes, "bytes");
    rec.value(`size.${label}.overheadRatio`, Number((envBytes / plainBytes).toFixed(3)), "x");

    for (let i = 0; i < N; i++) {
      await rec.time(`encrypt.${label}`, async () => encryptJSON(doc));
      const env = encryptJSON(doc);
      await rec.time(`decrypt.${label}`, async () => decryptJSON(env));
      const cid = await rec.time(`pin(encrypt+add).${label}`, () => pinEncryptedJSON(doc));
      const back = await rec.time(`fetch(cat+decrypt).${label}`, () => fetchDecryptedJSON(cid));
      if (JSON.stringify(back) !== JSON.stringify(doc)) {
        rec.check(`I-RT-${label}-${i}`, "integrity", `round trip equality (${label}, iter ${i})`, "equal", "differs", false);
      }
    }
    rec.check(`I-RT-${label}`, "integrity", `${N}x round trip of ${label} payload returns identical JSON`, "all equal", "all equal", !rec.checks.some((c) => c.id.startsWith(`I-RT-${label}-`) && !c.pass));
  }

  // ---- Check what can be seen by reading the raw IPFS data ----
  const addr = "0x" + crypto.randomBytes(20).toString("hex");
  const doc = sampleDidDocument(addr);
  const cid = await pinEncryptedJSON(doc);
  const raw = await rawCat(cid);
  const rawText = raw.toString("utf8");
  // Check that the original DID information and document fields are not visible in the data stored by IPFS.
  rec.check("I1", "confidentiality", "raw IPFS bytes do not contain the DID string", "absent", rawText.includes(doc.id) ? "present" : "absent", !rawText.includes(doc.id));
  rec.check("I2", "confidentiality", "raw IPFS bytes do not contain the wallet address", "absent", rawText.toLowerCase().includes(addr.slice(2)) ? "present" : "absent", !rawText.toLowerCase().includes(addr.slice(2)));
  rec.check("I3", "confidentiality", "raw IPFS bytes do not contain DID-document field names (e.g. 'verificationMethod')", "absent", rawText.includes("verificationMethod") ? "present" : "absent", !rawText.includes("verificationMethod"));
  
  const env = JSON.parse(rawText);
  rec.check("I4", "confidentiality", "stored object is only { alg, iv, ciphertext, tag }", "alg,ciphertext,iv,tag", Object.keys(env).sort().join(","), Object.keys(env).sort().join(",") === "alg,ciphertext,iv,tag");

  // Check that the document cannot be decrypted using a different key.
  const savedKey = config.encryptionKey;
  config.encryptionKey = crypto.randomBytes(32).toString("hex");
  let wrongKeyOutcome = "decrypted";
  try { decryptJSON(env); } catch { wrongKeyOutcome = "failed"; }
  config.encryptionKey = savedKey;
  rec.check("I5", "confidentiality", "decryption with a different key fails", "failed", wrongKeyOutcome, wrongKeyOutcome === "failed");

  // ---- Check content addressing and data integrity ----
  const recomputed = await rawAdd(raw, "only-hash=true");
  rec.check("I6", "integrity", "CID equals hash recomputed from the bytes fetched (self-certifying)", cid, recomputed, recomputed === cid);

  // Change one byte and confirm that the modified content produces a different CID.
  const mutated = Buffer.from(raw); mutated[mutated.length - 3] ^= 1;
  const mutatedCid = await rawAdd(mutated, "only-hash=true");
  rec.check("I7", "integrity", "altering one byte yields a different CID", "different", mutatedCid === cid ? "same" : "different", mutatedCid !== cid);

  // Change the ciphertext, IV and authentication tag separately. AES-GCM should reject each modified envelope during decryption.
  for (const field of ["ciphertext", "iv", "tag"]) {
    const tampered = JSON.parse(rawText);
    const buf = Buffer.from(tampered[field], "hex"); buf[0] ^= 0x01; tampered[field] = buf.toString("hex");
    let outcome;
    try { decryptJSON(tampered); outcome = "decrypted silently"; } catch (e) { outcome = "rejected"; }
    rec.check(`I8-${field}`, "integrity", `flipping one bit of the stored ${field} is detected on decrypt (GCM tag)`, "rejected", outcome, outcome === "rejected");
  }
  // Repeat the ciphertext modification test 200 times using random bits.
  let rejected = 0; const TRIALS = 200;
  for (let i = 0; i < TRIALS; i++) {
    const t = JSON.parse(rawText); const buf = Buffer.from(t.ciphertext, "hex");
    buf[Math.floor(Math.random() * buf.length)] ^= 1 << Math.floor(Math.random() * 8); t.ciphertext = buf.toString("hex");
    try { decryptJSON(t); } catch { rejected++; }
  }
  rec.check("I8-bulk", "integrity", `${TRIALS} random single-bit ciphertext corruptions are all rejected`, `${TRIALS}/${TRIALS}`, `${rejected}/${TRIALS}`, rejected === TRIALS);
  let legacy = "accepted";
  try { decryptJSON({ iv: env.iv, ciphertext: env.ciphertext }); } catch { legacy = "rejected"; }
  rec.check("I8-legacy", "integrity", "envelope without alg/tag (legacy CBC format) is refused", "rejected", legacy, legacy === "rejected");

  // Pin the same document twice and check that the random IV produces different encrypted content and therefore different CIDs.
  const cidA = await pinEncryptedJSON(doc), cidB = await pinEncryptedJSON(doc);
  rec.check("I9", "privacy", "identical plaintext pinned twice yields different CIDs (random IV prevents linkage)", "different", cidA === cidB ? "same" : "different", cidA !== cidB);

  // Check that the uploaded document is pinned on the local IPFS node.
  const pins = await (await rpc(`pin/ls?arg=${cid}&type=recursive`)).json();
  rec.check("I10", "availability", "pinned CID is listed as a recursive pin on the local node", "pinned", pins.Keys && pins.Keys[cid] ? "pinned" : "not pinned", Boolean(pins.Keys && pins.Keys[cid]));

  // ---- Measure upload performance when several documents are pinned together ----
  for (const conc of [1, 5, 10, 25]) {
    const docs = Array.from({ length: conc }, () => sampleDidDocument("0x" + crypto.randomBytes(20).toString("hex")));
    const t0 = process.hrtime.bigint();
    await Promise.all(docs.map((d) => pinEncryptedJSON(d)));
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    rec.sample(`concurrent.${conc}.batchMs`, ms, "ms");
    rec.sample(`concurrent.${conc}.opsPerSec`, (conc / ms) * 1000, "ops/s");
  }

  // ---- Check how the system handles a CID that does not exist ----
  const missing = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"; 
  const t0 = Date.now();
  let missingOutcome;
  try {
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 8000);
    await fetch(`${API}/api/v0/cat?arg=${missing}&timeout=5s`, { method: "POST", signal: ctl.signal }); clearTimeout(timer);
    missingOutcome = "returned";
  } catch { missingOutcome = "timed out / error"; }
  rec.value("missingCid.behaviour", `${missingOutcome} after ${Date.now() - t0} ms`, "");

  const failed = rec.checks.filter((c) => !c.pass).length;
  console.log(`\nChecks: ${rec.checks.length - failed}/${rec.checks.length} passed`);
  rec.save();
  if (failed) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
