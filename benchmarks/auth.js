// Measures login performance and checks that the authentication process handles normal logins and common security issues correctly.
process.env.NODE_ENV = "test";
const path = require("path");
const crypto = require("crypto");
const BACKEND = path.join(__dirname, "..", "backend");
const breq = (m) => require(require.resolve(m, { paths: [BACKEND] }));
const request = breq("supertest");
const jwt = breq("jsonwebtoken");
const { Wallet } = breq("ethers");
const app = require(path.join(BACKEND, "app"));
const nonceService = require(path.join(BACKEND, "services", "NonceService"));
const config = require(path.join(BACKEND, "config"));
const { jwtSecretProblems } = require(path.join(BACKEND, "config", "validate"));
const { Recorder } = require("./lib/recorder");

const N = Number(process.env.BENCH_N || 200);

async function login(wallet, rec, prefix) {
  const t0 = process.hrtime.bigint();
  const nonceRes = await request(app).get(`/api/auth/nonce/${wallet.address}`);
  const t1 = process.hrtime.bigint();
  const signature = await wallet.signMessage(nonceRes.body.message); // stands in for MetaMask signing
  const t2 = process.hrtime.bigint();
  const verifyRes = await request(app).post("/api/auth/verify").send({ address: wallet.address, signature });
  const t3 = process.hrtime.bigint();
  if (rec) {
    rec.sample(`${prefix}.nonceIssueMs`, Number(t1 - t0) / 1e6, "ms");
    rec.sample(`${prefix}.clientSignMs`, Number(t2 - t1) / 1e6, "ms", "local ethers signing; real MetaMask adds human approval time");
    rec.sample(`${prefix}.serverVerifyMs`, Number(t3 - t2) / 1e6, "ms");
    rec.sample(`${prefix}.fullLoginMs`, Number(t3 - t0) / 1e6, "ms");
  }
  return { nonceRes, signature, verifyRes };
}

async function main() {
  const rec = new Recorder("auth", { N, nonceTtlMs: nonceService.ttlMs, jwtExpiresIn: config.jwtExpiresIn });
  console.log(`Auth benchmark, N=${N}`);

  // ---- Measure login response times ----
  const wallet = Wallet.createRandom();
  await login(wallet, null, "warmup");
  for (let i = 0; i < N; i++) await login(Wallet.createRandom(), rec, "login");

  // ---- Measure how many logins can be handled at once ----
  // Each request uses a different wallet to avoid nonce conflicts.
  for (const conc of [10, 50]) {
    const wallets = Array.from({ length: conc }, () => Wallet.createRandom());
    const t0 = process.hrtime.bigint();
    const results = await Promise.all(wallets.map((w) => login(w, null, "x")));
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    rec.sample(`concurrent.${conc}.batchMs`, ms, "ms");
    rec.sample(`concurrent.${conc}.loginsPerSec`, (conc / ms) * 1000, "logins/s");
    rec.check(`A-C${conc}`, "functional", `${conc} concurrent logins all succeed`, `${conc}/${conc}`, `${results.filter((r) => r.verifyRes.status === 200).length}/${conc}`, results.every((r) => r.verifyRes.status === 200));
  }

  // ---- Functional: Check normal login behaviour ----
  const w = Wallet.createRandom();
  const ok = await login(w, null, "x");
  rec.check("A1", "functional", "valid signature returns 200 and a JWT", "200 + token", `${ok.verifyRes.status} ${ok.verifyRes.body.token ? "token" : "no token"}`, ok.verifyRes.status === 200 && !!ok.verifyRes.body.token);
  const payload = jwt.decode(ok.verifyRes.body.token) || {};
  rec.check("A2", "privacy", "JWT payload contains only address/iat/exp (no secrets or PII)", "address,exp,iat", Object.keys(payload).sort().join(","), Object.keys(payload).sort().join(",") === "address,exp,iat");
  rec.check("A3", "functional", "issued JWT is accepted by a protected route (not 401)", "!= 401", (await request(app).post("/api/did").set("Authorization", `Bearer ${ok.verifyRes.body.token}`).send({})).status, (await request(app).post("/api/did").set("Authorization", `Bearer ${ok.verifyRes.body.token}`).send({})).status !== 401);

  // ---- Security: Check that common login attacks are rejected ----
  const w2 = Wallet.createRandom();
  const first = await login(w2, null, "x");
  const replay = await request(app).post("/api/auth/verify").send({ address: w2.address, signature: first.signature });
  rec.check("S1", "security", "Reused signature with an already-used nonce", "400", replay.status, replay.status === 400);

  const victim = Wallet.createRandom(), attacker = Wallet.createRandom();
  const vn = await request(app).get(`/api/auth/nonce/${victim.address}`);
  const forged = await request(app).post("/api/auth/verify").send({ address: victim.address, signature: await attacker.signMessage(vn.body.message) });
  rec.check("S2", "security", "signature from a different wallet is rejected", "401", forged.status, forged.status === 401);

  const never = Wallet.createRandom();
  const noNonce = await request(app).post("/api/auth/verify").send({ address: never.address, signature: await never.signMessage("anything") });
  rec.check("S3", "security", "verify without a valid nonce is rejected", "400", noNonce.status, noNonce.status === 400);

  const wm = Wallet.createRandom();
  await request(app).get(`/api/auth/nonce/${wm.address}`);
  const malformed = await request(app).post("/api/auth/verify").send({ address: wm.address, signature: "0xdeadbeef" });
  rec.check("S4", "security", "Invalid signature that should not crash the server", "401", malformed.status, malformed.status === 401);

  const wo = Wallet.createRandom();
  const n1 = await request(app).get(`/api/auth/nonce/${wo.address}`);
  const sigOld = await wo.signMessage(n1.body.message);
  await request(app).get(`/api/auth/nonce/${wo.address}`); // overwrites n1
  const stale = await request(app).post("/api/auth/verify").send({ address: wo.address, signature: sigOld });
  rec.check("S5", "security", "Signature using an old or replaced nonce", "401", stale.status, stale.status === 401);

  const we = Wallet.createRandom();
  const savedTtl = nonceService.ttlMs;
  nonceService.ttlMs = 30;
  const ne = await request(app).get(`/api/auth/nonce/${we.address}`);
  const sigE = await we.signMessage(ne.body.message);
  await new Promise((r) => setTimeout(r, 80));
  nonceService.ttlMs = savedTtl;
  const expired = await request(app).post("/api/auth/verify").send({ address: we.address, signature: sigE });
  rec.check("S6", "security", "expired nonce is rejected", "400", expired.status, expired.status === 400);

  // Check that a challenge issued to one wallet cannot be used by another wallet.
  const A = Wallet.createRandom(), B = Wallet.createRandom();
  const na = await request(app).get(`/api/auth/nonce/${A.address}`);
  await request(app).get(`/api/auth/nonce/${B.address}`);
  const cross = await request(app).post("/api/auth/verify").send({ address: B.address, signature: await A.signMessage(na.body.message) });
  rec.check("S7", "security", "Using wallet A's challenge to authenticate wallet B", "401", cross.status, cross.status === 401);

  const lower = Wallet.createRandom();
  const nl = await request(app).get(`/api/auth/nonce/${lower.address.toLowerCase()}`);
  const caseRes = await request(app).post("/api/auth/verify").send({ address: lower.address, signature: await lower.signMessage(nl.body.message) });
  rec.check("S8", "functional", "address case (checksum vs lowercase) does not break login", "200", caseRes.status, caseRes.status === 200);

  // Check that protected routes reject missing, altered or incorrectly signed JWTs.
  const noTok = await request(app).post("/api/did").send({});
  rec.check("S9", "security", "protected route without token is rejected", "401", noTok.status, noTok.status === 401);
  const badTok = await request(app).post("/api/did").set("Authorization", "Bearer " + ok.verifyRes.body.token.slice(0, -2) + "xx").send({});
  rec.check("S10", "security", "JWT with altered signature is rejected", "401", badTok.status, badTok.status === 401);
  const forgedJwt = jwt.sign({ address: w.address.toLowerCase() }, "wrong-secret");
  const fj = await request(app).post("/api/did").set("Authorization", `Bearer ${forgedJwt}`).send({});
  rec.check("S11", "security", "JWT signed with a different secret is rejected", "401", fj.status, fj.status === 401);
  const algNone = [Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url"), Buffer.from(JSON.stringify({ address: w.address })).toString("base64url"), ""].join(".");
  const an = await request(app).post("/api/did").set("Authorization", `Bearer ${algNone}`).send({});
  rec.check("S12", "security", "unsigned (alg=none) JWT is rejected", "401", an.status, an.status === 401);
  const jwtProblems = jwtSecretProblems(config.jwtSecret); // never prints the secret itself
  rec.check("S13", "security", "JWT secret is set, is not a default/placeholder value, and is at least 32 characters", "no problems", jwtProblems.length === 0 ? `custom, ${config.jwtSecret.length} characters` : jwtProblems.join("; "), jwtProblems.length === 0);

  // ---- Check that data endpoints require an authenticated session ----
  const addr0 = "0x" + "ab".repeat(20), hash0 = "0x" + "cd".repeat(32);
  const gets = [
    ["S14", "decrypted DID document endpoint requires a session", `/api/did/${addr0}/document`],
    ["S15", "decrypted credential contents endpoint requires a session", `/api/credentials/${hash0}/document`],
    ["S16", "credential listing requires a session", "/api/credentials"],
  ];
  for (const [id, desc, url] of gets) {
    const r = await request(app).get(url);
    rec.check(id, "security", desc, "401", r.status, r.status === 401);
  }
  const iss = await request(app).post("/api/credentials/issue").send({});
  rec.check("S17", "security", "credential issuance requires a session", "401", iss.status, iss.status === 401);

  const me = Wallet.createRandom(), other = Wallet.createRandom();
  const meTok = (await login(me, null, "x")).verifyRes.body.token;
  const prep = await request(app).post("/api/credentials/prepare").set("Authorization", `Bearer ${meTok}`).send({
    issuerDID: `did:ethr:${other.address.toLowerCase()}`, subjectDID: `did:ethr:${addr0}`, type: ["T"], credentialSubject: { a: 1 },
  });
  rec.check("S18", "security", "cannot prepare a credential under another wallet's issuer DID", "403", prep.status, prep.status === 403);
  const conf = await request(app).patch(`/api/did/${other.address}/confirm`).set("Authorization", `Bearer ${meTok}`).send({ did: "x", docCID: "y" });
  rec.check("S19", "security", "cannot index/confirm another address's DID", "403", conf.status, conf.status === 403);
  const otherDid = `did:ethr:${other.address.toLowerCase()}`;
  const pin = await request(app).post("/api/did").set("Authorization", `Bearer ${meTok}`).send({ did: otherDid, didDocument: { id: otherDid } });
  rec.check("S20", "security", "cannot pin a DID document for another wallet's DID", "403", pin.status, pin.status === 403);

  // ---- Check the quality of generated nonces ----
  const seen = new Set(); let dup = 0, badLen = 0, ones = 0, bits = 0;
  for (let i = 0; i < 10000; i++) {
    const addr = Wallet.createRandom().address;
    const nonce = nonceService.issue(addr);
    if (seen.has(nonce)) dup++; seen.add(nonce);
    if (!/^[0-9a-f]{64}$/.test(nonce)) badLen++;
    for (const byte of Buffer.from(nonce, "hex")) { let b = byte; while (b) { ones += b & 1; b >>= 1; } bits += 8; }
    nonceService.consume(addr);
  }
  rec.check("N1", "security", "10,000 nonces: no duplicates", "0", dup, dup === 0);
  rec.check("N2", "security", "every nonce is 32 bytes (64 hex chars)", "0 malformed", badLen, badLen === 0);
  const ratio = ones / bits;
  rec.value("nonce.bitOnesRatio", Number(ratio.toFixed(4)), "(~0.5 expected)");
  rec.check("N3", "security", "bit balance of nonces within 49-51% (sanity check, NOT a randomness proof)", "0.49-0.51", ratio.toFixed(4), ratio > 0.49 && ratio < 0.51);

  // ---- Record comparison with password based login ----
  rec.value("server.storesSecretPerUser", "No - only transient nonce per address (in-memory) ; no password or password hash exists", "");

  const failed = rec.checks.filter((c) => !c.pass).length;
  console.log(`\nChecks: ${rec.checks.length - failed}/${rec.checks.length} passed`);
  rec.save();
  if (failed) process.exitCode = 1;
  process.exit(failed ? 1 : 0); 
}

main().catch((e) => { console.error(e); process.exit(1); });