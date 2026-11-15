const { Wallet, getBytes } = require("ethers");
const svc = require("../services/credential.service");

async function issue(wallet, claims = { degree: "BCompSc" }) {
  const vc = svc.buildCredential({
    issuerDID: `did:ethr:${wallet.address.toLowerCase()}`,
    subjectDID: "did:ethr:0x" + "1".repeat(40),
    type: ["UniversityDegreeCredential"],
    credentialSubject: claims,
  });
  const hash = svc.hashCredential(vc);
  const signature = await wallet.signMessage(getBytes(hash));
  return { vc, hash, signed: svc.attachProof(vc, signature) };
}

describe("Verifiable Credential hashing and proofs", () => {
  it("hash is independent of key order and of the proof field", async () => {
    const { vc, hash, signed } = await issue(Wallet.createRandom());
    expect(svc.hashCredential(signed)).toBe(hash);
    const reordered = JSON.parse(JSON.stringify(vc, Object.keys(vc).sort().reverse()));
    expect(svc.hashCredential(reordered)).toBe(hash);
  });

  it("accepts a correctly signed credential", async () => {
    const { signed } = await issue(Wallet.createRandom());
    expect(svc.verifyProof(signed).proofValid).toBe(true);
  });

  it("rejects a credential with no proof", async () => {
    const { vc } = await issue(Wallet.createRandom());
    const r = svc.verifyProof(vc);
    expect(r.hasProof).toBe(false);
    expect(r.proofValid).toBe(false);
  });

  it("rejects a credential whose claims were altered after signing", async () => {
    const { signed } = await issue(Wallet.createRandom(), { grade: "Pass" });
    const forged = JSON.parse(JSON.stringify(signed));
    forged.credentialSubject.grade = "High Distinction";
    expect(svc.verifyProof(forged).proofValid).toBe(false);
  });

  it("rejects a proof signed by someone other than the issuer DID", async () => {
    const issuer = Wallet.createRandom(), attacker = Wallet.createRandom();
    const { vc, hash } = await issue(issuer);
    const forged = svc.attachProof(vc, await attacker.signMessage(getBytes(hash)));
    expect(svc.verifyProof(forged).proofValid).toBe(false);
  });

  it("rejects a malformed signature without throwing", async () => {
    const { vc } = await issue(Wallet.createRandom());
    expect(svc.verifyProof(svc.attachProof(vc, "0xdeadbeef")).proofValid).toBe(false);
  });

  it("extracts addresses from did:ethr identifiers", () => {
    const a = "0x" + "ab".repeat(20);
    expect(svc.addressFromDID(`did:ethr:${a}`)).toBe(a);
    expect(svc.addressFromDID(`did:ethr:0x5:${a}`)).toBe(a);
    expect(svc.addressFromDID("did:web:example.com")).toBeNull();
  });
});
