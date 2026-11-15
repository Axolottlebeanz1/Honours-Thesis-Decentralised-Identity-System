// Measures smart contract performance and checks that the main functions and access controls behave as expected.
const hre = require("hardhat");
const { ethers, network } = hre;
const { Recorder } = require("./lib/recorder");

const N = Number(process.env.BENCH_N || 25);
const GAS_PRICE_GWEI = Number(process.env.GAS_PRICE_GWEI || 20);
const ETH_USD = Number(process.env.ETH_USD || 3000);

// Sample CIDv0 and CIDv1 values used to compare registration gas costs.
const CID_V0 = "Qm" + "a".repeat(44);
const CID_V1 = "bafy" + "b".repeat(55);

async function freshSigners(count) {
  const out = [];
  const known = await ethers.getSigners();
  for (const s of known) { if (out.length < count) out.push(s); }
  // Create and fund extra wallets if Hardhat does not provide enough accounts.
  while (out.length < count) {
    const w = ethers.Wallet.createRandom().connect(ethers.provider);
    await network.provider.send("hardhat_setBalance", [w.address, "0x56BC75E2D63100000"]); // 100 ETH
    out.push(w);
  }
  return out;
}

// Sends a transaction and records how long it takes to be mined, along with the gas used.
async function measured(rec, name, sendFn) {
  const t0 = process.hrtime.bigint();
  const tx = await sendFn();
  const receipt = await tx.wait();
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  rec.sample(`${name}.gas`, Number(receipt.gasUsed), "gas");
  rec.sample(`${name}.latencyMs`, ms, "ms", "send -> mined (network-dependent)");
  return { receipt, tx };
}

async function main() {
  const rec = new Recorder("chain", { network: network.name, N, GAS_PRICE_GWEI, ETH_USD, solidity: "0.8.20 (optimizer 200 runs)" });
  console.log(`Chain benchmark on '${network.name}', N=${N}`);

  // ---------- Deploy the smart contracts ----------
  const [deployer] = await ethers.getSigners();
  const DID = await ethers.getContractFactory("DIDRegistry");
  const didRegistry = await DID.deploy();
  const didDeployReceipt = await didRegistry.deploymentTransaction().wait();
  await didRegistry.waitForDeployment();
  const CRED = await ethers.getContractFactory("CredentialRegistry");
  const credRegistry = await CRED.deploy(await didRegistry.getAddress());
  const credDeployReceipt = await credRegistry.deploymentTransaction().wait();
  await credRegistry.waitForDeployment();
  rec.value("deploy.DIDRegistry.gas", Number(didDeployReceipt.gasUsed), "gas");
  rec.value("deploy.CredentialRegistry.gas", Number(credDeployReceipt.gasUsed), "gas");

  const signers = await freshSigners(N + 2);
  const issuers = signers.slice(0, N);
  const subject = signers[N];
  const outsider = signers[N + 1];

  // ---------- Register DIDs using CIDv0 and CIDv1 ----------
  for (let i = 0; i < N; i++) {
    const s = issuers[i];
    const cid = i % 2 === 0 ? CID_V0 : CID_V1;
    const did = `did:ethr:${s.address.toLowerCase()}`;
    await measured(rec, i % 2 === 0 ? "registerDID.CIDv0" : "registerDID.CIDv1", () => didRegistry.connect(s).registerDID(did, cid));
  }

  // ---------- Update existing DIDs ----------
  for (let i = 0; i < N; i++) {
    await measured(rec, "updateDID", () => didRegistry.connect(issuers[i]).updateDID(CID_V1));
  }

  // ---------- Measure read operations ----------
  for (let i = 0; i < N; i++) {
    await rec.time("resolveDID.readMs", () => didRegistry.resolveDID(issuers[i].address));
    await rec.time("hasActiveDID.readMs", () => didRegistry.hasActiveDID(issuers[i].address));
  }

  // ---------- Register, check and revoke credentials ----------
  const hashes = [];
  for (let i = 0; i < N; i++) {
    const h = ethers.keccak256(ethers.toUtf8Bytes(`bench-credential-${i}-${Date.now()}`));
    hashes.push(h);
    const { tx } = await measured(rec, "registerCredential", () => credRegistry.connect(issuers[i]).registerCredential(h));
    if (i === 0) rec.value("registerCredential.calldataBytes", (tx.data.length - 2) / 2, "bytes");
  }
  for (let i = 0; i < N; i++) {
    await rec.time("isRevoked.readMs", () => credRegistry.isRevoked(hashes[i]));
    await rec.time("getRecord.readMs", () => credRegistry.getRecord(hashes[i]));
  }
  for (let i = 0; i < N; i++) {
    await measured(rec, "revokeCredential", () => credRegistry.connect(issuers[i]).revokeCredential(hashes[i]));
  }
  for (let i = 0; i < N; i++) {
    await measured(rec, "deactivateDID", () => didRegistry.connect(issuers[i]).deactivateDID());
  }

  // ---------- Check whether gas changes as the registry grows ----------
  // Compare the gas used by the first and last DID registrations.
  const regs = [...(rec.metrics["registerDID.CIDv0"]?.samples || [])];
  if (regs.length > 1) {
    rec.value("scalability.registerDID.firstGas", regs[0], "gas");
    rec.value("scalability.registerDID.lastGas", regs[regs.length - 1], "gas");
  }

  // ---------- Run functional and security checks ----------
  console.log("\nFunctional / security checks:");
  const a = signers[0], b = outsider;
  // Use fresh contracts so the earlier benchmark operations do not affect these tests.
  const did2 = await (await ethers.getContractFactory("DIDRegistry")).deploy();
  const cred2 = await (await ethers.getContractFactory("CredentialRegistry")).deploy(await did2.getAddress());
  const subjDid = `did:ethr:${subject.address.toLowerCase()}`;
  const aDid = `did:ethr:${a.address.toLowerCase()}`;

  // Functional: Check that the main contract functions work as expected.
  await (await did2.connect(a).registerDID(aDid, CID_V0)).wait();
  const r = await did2.resolveDID(a.address);
  rec.check("F1", "functional", "DID registration stores the correct details and sets it as active", "match", r.did === aDid && r.docCID === CID_V0 && r.owner === a.address && r.active ? "match" : "mismatch", r.did === aDid && r.docCID === CID_V0 && r.owner === a.address && r.active);
  const tsOk = Number(r.timestamp) > 0;
  rec.check("F2", "functional", "DID registration records a timestamp", "> 0", Number(r.timestamp), tsOk);

  const rcpt = await (await did2.connect(a).updateDID(CID_V1)).wait();
  const upd = await did2.resolveDID(a.address);
  rec.check("F3", "functional", "DID document CID is updated correctly", CID_V1, upd.docCID, upd.docCID === CID_V1);
  const evts = rcpt.logs.map((l) => { try { return did2.interface.parseLog(l)?.name; } catch { return null; } });
  rec.check("F4", "functional", "DIDUpdated event is emitted after an update", "DIDUpdated", evts.join(","), evts.includes("DIDUpdated"));

  rec.check("F5", "functional", "active DID check returns the correct result for registered and unknown users", "true,false", `${await did2.hasActiveDID(a.address)},${await did2.hasActiveDID(b.address)}`, (await did2.hasActiveDID(a.address)) === true && (await did2.hasActiveDID(b.address)) === false);

  await (await did2.connect(subject).registerDID(subjDid, CID_V0)).wait();
  const h = ethers.keccak256(ethers.toUtf8Bytes("functional-credential"));
  const cr = await (await cred2.connect(a).registerCredential(h)).wait();
  const crEvts = cr.logs.map((l) => { try { return cred2.interface.parseLog(l)?.name; } catch { return null; } });
  rec.check("F6", "functional", "credential registration event is emitted", "CredentialRegistered", crEvts.join(","), crEvts.includes("CredentialRegistered"));
  rec.check("F7", "functional", "credential is not revoked when first registered", "false", String(await cred2.isRevoked(h)), (await cred2.isRevoked(h)) === false);
  await (await cred2.connect(a).revokeCredential(h)).wait();
  rec.check("F8", "functional", "credential is marked as revoked after revocation", "true", String(await cred2.isRevoked(h)), (await cred2.isRevoked(h)) === true);
  rec.check("F9", "functional", "unknown credential hash is not marked as revoked", "false", String(await cred2.isRevoked(ethers.ZeroHash)), (await cred2.isRevoked(ethers.ZeroHash)) === false);
  
  // Security: Check that only authorised users can perform restricted actions.
  await rec.expectRevert("S1", "security", "duplicate DID registration from same address is rejected", () => did2.connect(a).registerDID(aDid, CID_V0), "already has a registered DID");
  await rec.expectRevert("S2", "security", "non-owner cannot update another address's DID", () => did2.connect(b).updateDID(CID_V0), "no registered DID");
  await rec.expectRevert("S3", "security", "non-owner cannot deactivate another address's DID", () => did2.connect(b).deactivateDID(), "no registered DID");
  await rec.expectRevert("S4", "security", "resolving an unregistered address reverts", () => did2.resolveDID(b.address), "no DID registered");
  await rec.expectRevert("S5", "security", "empty DID string rejected", () => did2.connect(b).registerDID("", CID_V0), "empty DID");
  await rec.expectRevert("S6", "security", "empty CID rejected", () => did2.connect(b).registerDID("did:ethr:x", ""), "empty docCID");
  await rec.expectRevert("S7", "security", "address without an active DID cannot register a credential", () => cred2.connect(b).registerCredential(ethers.keccak256("0x1234")), "no active DID");
  await rec.expectRevert("S8", "security", "duplicate credential hash rejected", () => cred2.connect(a).registerCredential(h), "already registered");
  const h2 = ethers.keccak256(ethers.toUtf8Bytes("second-credential"));
  await (await cred2.connect(a).registerCredential(h2)).wait();
  await rec.expectRevert("S9", "security", "non-issuer cannot revoke a credential", () => cred2.connect(subject).revokeCredential(h2), "not the issuer");
  await rec.expectRevert("S10", "security", "revoking an already-revoked credential is rejected", () => cred2.connect(a).revokeCredential(h), "already revoked");
  await rec.expectRevert("S11", "security", "revoking an unregistered credential is rejected", () => cred2.connect(a).revokeCredential(ethers.keccak256("0xdead")), "not registered");
  await (await did2.connect(a).deactivateDID()).wait();
  await rec.expectRevert("S12", "security", "deactivated DID cannot be updated", () => did2.connect(a).updateDID(CID_V1), "deactivated");
  await rec.expectRevert("S13", "security", "issuer with a deactivated DID cannot register new credentials", () => cred2.connect(a).registerCredential(ethers.keccak256("0xbeef")), "no active DID");
  await rec.expectRevert("S14", "security", "CredentialRegistry constructor rejects zero address", async () => (await ethers.getContractFactory("CredentialRegistry")).deploy(ethers.ZeroAddress), "zero address");

  // Privacy: Check how much information is included in the on chain transaction data.
  const calldata = rec.values["registerCredential.calldataBytes"]?.value;
  rec.check("P1", "privacy", "registerCredential calldata is selector (4 B) + one bytes32 hash (32 B) only", "36 bytes", `${calldata} bytes`, calldata === 36);

  // ---------- Estimate transaction costs ----------
  const costRows = {};
  for (const [name, m] of Object.entries(rec.metrics)) {
    if (!name.endsWith(".gas")) continue;
    const mean = m.samples.reduce((x, y) => x + y, 0) / m.samples.length;
    costRows[name.replace(".gas", "")] = { meanGas: Math.round(mean), usd: (mean * GAS_PRICE_GWEI * 1e-9 * ETH_USD) };
  }
  rec.value("costEstimate", costRows, `USD @ ${GAS_PRICE_GWEI} gwei, ETH=$${ETH_USD} (assumed)`);

  const failed = rec.checks.filter((c) => !c.pass).length;
  console.log(`\nChecks: ${rec.checks.length - failed}/${rec.checks.length} passed`);
  rec.save();
  if (failed) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });