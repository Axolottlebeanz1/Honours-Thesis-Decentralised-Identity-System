// Tests the full process across the backend services, IPFS and smart contracts.
// It checks that:
// - DID Documents can be encrypted, uploaded, retrieved and decrypted.
// - The CID returned by IPFS matches the CID registered on the blockchain.
// - Credentials can be issued, verified and revoked across the different components.
// Requirements: IPFS must be running and the backend dependencies installed.

const crypto = require("crypto");
const path = require("path");
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString("hex");

const { ethers, network } = require("hardhat");
const { getBytes } = ethers;
const BACKEND = path.join(__dirname, "..", "backend");
const { pinEncryptedJSON, fetchDecryptedJSON } = require(path.join(BACKEND, "services", "ipfs.service"));
const credentialService = require(path.join(BACKEND, "services", "credential.service"));
const config = require(path.join(BACKEND, "config"));
const { Recorder } = require("./lib/recorder");

const N = Number(process.env.BENCH_N || 10);

function didDoc(did, address) {
  return {
    "@context": "https://www.w3.org/ns/did/v1", id: did, controller: did,
    verificationMethod: [{ id: `${did}#keys-1`, type: "EcdsaSecp256k1RecoveryMethod2020", controller: did, blockchainAccountId: `eip155:31337:${address}` }],
    authentication: [`${did}#keys-1`],
  };
}

async function main() {
  const rec = new Recorder("e2e", { network: network.name, N, ipfsApi: config.ipfsApiUrl });
  console.log(`E2E lifecycle benchmark on '${network.name}', N=${N}`);

  const didRegistry = await (await ethers.getContractFactory("DIDRegistry")).deploy();
  const credRegistry = await (await ethers.getContractFactory("CredentialRegistry")).deploy(await didRegistry.getAddress());
  const signers = await ethers.getSigners();
  const issuer = signers[0], subject = signers[1];
  const issuerDID = `did:ethr:${issuer.address.toLowerCase()}`;
  const subjectDID = `did:ethr:${subject.address.toLowerCase()}`;

  let docMatches = 0, cidMatches = 0, vcMatches = 0, revokeFlow = 0, hashStable = 0;

  // ---- Stage A: Register and retrieve DID Documents ----
  for (let i = 0; i < N; i++) {
    const w = i === 0 ? issuer : ethers.Wallet.createRandom().connect(ethers.provider);
    if (i > 0) await network.provider.send("hardhat_setBalance", [w.address, "0x56BC75E2D63100000"]);
    const did = `did:ethr:${w.address.toLowerCase()}`;
    const doc = didDoc(did, w.address);

    const t0 = process.hrtime.bigint();
    const docCID = await rec.time("did.1_encryptAndPin", () => pinEncryptedJSON(doc));
    const tx = await rec.time("did.2_registerOnChain", async () => { const t = await didRegistry.connect(w).registerDID(did, docCID); return t.wait(); });
    rec.sample("did.2_registerOnChain.gas", Number(tx.gasUsed), "gas");
    const onChain = await rec.time("did.3_resolveOnChain", () => didRegistry.resolveDID(w.address));
    const fetched = await rec.time("did.4_fetchAndDecrypt", () => fetchDecryptedJSON(onChain.docCID));
    rec.sample("did.TOTAL_registerToResolve", Number(process.hrtime.bigint() - t0) / 1e6, "ms", "pin + tx + resolve + fetch/decrypt");

    if (onChain.docCID === docCID) cidMatches++;
    if (JSON.stringify(fetched) === JSON.stringify(doc)) docMatches++;
  }
  rec.check("E1", "integration", `CID stored on chain matches the CID returned by IPFS (${N}x)`, `${N}/${N}`, `${cidMatches}/${N}`, cidMatches === N);
  rec.check("E2", "integration", `DID document retrieved from IPFS matches the original after decryption (${N}x)`, `${N}/${N}`, `${docMatches}/${N}`, docMatches === N);

  // ---- Stage B: Issue, store, verify and revoke credentials ----
  await (await didRegistry.connect(subject).registerDID(subjectDID, "placeholder-subject-cid")).wait();
  let proofOk = 0, proofRejectedForged = 0;
  for (let i = 0; i < N; i++) {
    const t0 = process.hrtime.bigint();
    const vc = credentialService.buildCredential({
      issuerDID, subjectDID, type: ["UniversityDegreeCredential"],
      credentialSubject: { degree: "BCompSc (Hons)", run: i },
    });
    const hash = await rec.time("vc.1_buildAndHash", async () => credentialService.hashCredential(vc));
    if (credentialService.hashCredential(JSON.parse(JSON.stringify(vc))) === hash) hashStable++;

    const signature = await rec.time("vc.2_issuerSignsHash", () => issuer.signMessage(getBytes(hash)));
    const signed = credentialService.attachProof(vc, signature);
    if (credentialService.hashCredential(signed) === hash) hashStable++;

    const cid = await rec.time("vc.3_encryptAndPinSigned", () => pinEncryptedJSON(signed));
    const reg = await rec.time("vc.4_registerHashOnChain", async () => (await credRegistry.connect(issuer).registerCredential(hash)).wait());
    rec.sample("vc.4_registerHashOnChain.gas", Number(reg.gasUsed), "gas");

    // Simulates a verifier receiving a credential and checking it using the presented credential and blockchain record, 
    // without needing access to the issuer's private key or login session.
    const presented = await rec.time("vc.5_fetchAndDecrypt", () => fetchDecryptedJSON(cid));
    const verdict = await rec.time("vc.6_verifyProofAndChain(valid)", async () => {
      const p = credentialService.verifyProof(presented);
      const r = await credRegistry.getRecord(p.credentialHash);
      return { p, r, ok: p.proofValid && r.issued && !r.revoked && r.issuer.toLowerCase() === p.signer };
    });
    if (verdict.p.proofValid) proofOk++;
    if (JSON.stringify(presented) === JSON.stringify(signed) && verdict.ok) vcMatches++;

    // Change a claim without updating the signature. The original signature should no longer be valid.
    const forgedCopy = JSON.parse(JSON.stringify(presented)); forgedCopy.credentialSubject.degree = "PhD";
    if (!credentialService.verifyProof(forgedCopy).proofValid) proofRejectedForged++;

    const rv = await rec.time("vc.7_revokeOnChain", async () => (await credRegistry.connect(issuer).revokeCredential(hash)).wait());
    rec.sample("vc.7_revokeOnChain.gas", Number(rv.gasUsed), "gas");
    const after = await rec.time("vc.8_verifyOnChain(revoked)", () => credRegistry.getRecord(hash));
    if (verdict.ok && after.revoked) revokeFlow++;
    rec.sample("vc.TOTAL_issueVerifyRevoke", Number(process.hrtime.bigint() - t0) / 1e6, "ms");
  }
  rec.check("E3", "integration", `signed credential can be retrieved and verified (${N}x)`, `${N}/${N}`, `${vcMatches}/${N}`, vcMatches === N);
  rec.check("E4", "integration", `credential is valid before revocation and revoked afterwards (${N}x)`, `${N}/${N}`, `${revokeFlow}/${N}`, revokeFlow === N);
  rec.check("E5", "integration", `credential hash stays the same after copying and signing (${N * 2}x)`, `${N * 2}/${N * 2}`, `${hashStable}/${N * 2}`, hashStable === N * 2);
  rec.check("E5b", "security", `credential signature matches the issuer's address (${N}x)`, `${N}/${N}`, `${proofOk}/${N}`, proofOk === N);
  rec.check("E5c", "security", `edited credential is rejected when using the original signature (${N}x)`, `${N}/${N}`, `${proofRejectedForged}/${N}`, proofRejectedForged === N);

  const a1 = { b: 1, a: { y: 2, x: 3 } }, b1 = { a: { x: 3, y: 2 }, b: 1 };
  rec.check("E6", "integration", "same credential data produces the same hash regardless of key order", "equal", credentialService.hashCredential(a1) === credentialService.hashCredential(b1) ? "equal" : "different", credentialService.hashCredential(a1) === credentialService.hashCredential(b1));

  // Check that changing a credential claim also changes its hash. The modified credential should not match the original blockchain record.
  const vc2 = credentialService.buildCredential({ issuerDID, subjectDID, type: ["T"], credentialSubject: { grade: "Pass" } });
  const h2 = credentialService.hashCredential(vc2);
  const signed2 = credentialService.attachProof(vc2, await issuer.signMessage(getBytes(h2)));
  await (await credRegistry.connect(issuer).registerCredential(h2)).wait();
  const forged = JSON.parse(JSON.stringify(signed2)); forged.credentialSubject.grade = "High Distinction";
  const forgedHash = credentialService.hashCredential(forged);
  const forgedRec = await credRegistry.getRecord(forgedHash);
  rec.check("E7", "security", "changing a credential claim produces a different hash that is not registered on chain", "not issued", forgedRec.issued ? "issued" : "not issued", !forgedRec.issued && forgedHash !== h2);

  // Check that a signature from another wallet cannot be used to present the credential as though it came from the issuer.
  const attacker = ethers.Wallet.createRandom();
  const evil = credentialService.attachProof(vc2, await attacker.signMessage(getBytes(h2)));
  rec.check("E7b", "security", "credential signed by someone other than the issuer is rejected", "proofValid=false", `proofValid=${credentialService.verifyProof(evil).proofValid}`, credentialService.verifyProof(evil).proofValid === false);

  // Check that a correctly signed credential is still rejected if its hash has not been registered on the blockchain.
  const vc3 = credentialService.buildCredential({ issuerDID, subjectDID, type: ["T"], credentialSubject: { never: "registered" } });
  const h3 = credentialService.hashCredential(vc3);
  const signed3 = credentialService.attachProof(vc3, await issuer.signMessage(getBytes(h3)));
  const rec3 = await credRegistry.getRecord(credentialService.verifyProof(signed3).credentialHash);
  rec.check("E7c", "security", "credential without an on chain registration is rejected", "issued=false", `issued=${rec3.issued}`, credentialService.verifyProof(signed3).proofValid && !rec3.issued);
  
  // Record known design limitations separately from test failures.
  rec.value("vc.hasProofField", true, "");
  rec.value("limitation.credentialCidOffChainOnly", "Credential IPFS CIDs are indexed in MongoDB only, not on chain (only DID CIDs are on chain). The 'on chain CID matches IPFS document' check (E1/E2) therefore applies to DID documents; credentials are anchored by hash and verified by signature + hash.");
  rec.value("limitation.serverHeldKey", "A single AES key held in the backend protects off chain data; the backend is a trusted component for confidentiality (not for credential validity).");

  const failed = rec.checks.filter((c) => !c.pass).length;
  console.log(`\nChecks: ${rec.checks.length - failed}/${rec.checks.length} passed`);
  rec.save();
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });