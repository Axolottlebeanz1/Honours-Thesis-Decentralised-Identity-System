const request = require("supertest");
const { Wallet } = require("ethers");
const app = require("../app");

// Tests the wallet-signature login flow, including creating a nonce, signing it and checking the signature. 
// The tests also cover rejecting reused nonces and signatures from the wrong wallet.
describe("Auth flow", () => {
  it("issues a nonce, verifies a valid signature, and returns a session token", async () => {
    const wallet = Wallet.createRandom();

    const nonceRes = await request(app).get(`/api/auth/nonce/${wallet.address}`);
    expect(nonceRes.status).toBe(200);
    expect(nonceRes.body.message).toMatch(/Nonce:/);

    const signature = await wallet.signMessage(nonceRes.body.message);

    const verifyRes = await request(app)
      .post("/api/auth/verify")
      .send({ address: wallet.address, signature });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.token).toBeDefined();
  });

  it("rejects a replayed signature (same nonce submitted twice)", async () => {
    const wallet = Wallet.createRandom();

    const nonceRes = await request(app).get(`/api/auth/nonce/${wallet.address}`);
    const signature = await wallet.signMessage(nonceRes.body.message);

    const firstAttempt = await request(app)
      .post("/api/auth/verify")
      .send({ address: wallet.address, signature });
    expect(firstAttempt.status).toBe(200);

    // The nonce was removed after the first successful login.
    // Trying to use the same signature again should now fail.
    const replayAttempt = await request(app)
      .post("/api/auth/verify")
      .send({ address: wallet.address, signature });
    expect(replayAttempt.status).toBe(400);
  });

  it("rejects a signature produced by a different wallet than the claimed address", async () => {
    const claimedWallet = Wallet.createRandom();
    const attackerWallet = Wallet.createRandom();

    const nonceRes = await request(app).get(`/api/auth/nonce/${claimedWallet.address}`);
    const forgedSignature = await attackerWallet.signMessage(nonceRes.body.message);

    const verifyRes = await request(app)
      .post("/api/auth/verify")
      .send({ address: claimedWallet.address, signature: forgedSignature });

    expect(verifyRes.status).toBe(401);
  });

  it("rejects verification when no nonce was ever issued for the address", async () => {
    const wallet = Wallet.createRandom();
    const bogusSignature = await wallet.signMessage("not the real challenge");

    const verifyRes = await request(app)
      .post("/api/auth/verify")
      .send({ address: wallet.address, signature: bogusSignature });

    expect(verifyRes.status).toBe(400);
  });

  describe("authorization on data endpoints (rejected before any DB/chain access)", () => {
    const addr = "0x" + "ab".repeat(20);
    const hash = "0x" + "cd".repeat(32);

    it("requires a session to read decrypted DID documents", async () => {
      expect((await request(app).get(`/api/did/${addr}/document`)).status).toBe(401);
    });

    it("requires a session to read decrypted credential contents", async () => {
      expect((await request(app).get(`/api/credentials/${hash}/document`)).status).toBe(401);
    });

    it("requires a session to list credentials", async () => {
      expect((await request(app).get("/api/credentials")).status).toBe(401);
    });

    it("requires a session to issue credentials", async () => {
      expect((await request(app).post("/api/credentials/issue").send({})).status).toBe(401);
    });

    async function login(wallet) {
      const n = await request(app).get(`/api/auth/nonce/${wallet.address}`);
      const sig = await wallet.signMessage(n.body.message);
      return (await request(app).post("/api/auth/verify").send({ address: wallet.address, signature: sig })).body.token;
    }

    it("forbids preparing a credential under someone else's issuer DID", async () => {
      const me = Wallet.createRandom(), other = Wallet.createRandom();
      const token = await login(me);
      const res = await request(app).post("/api/credentials/prepare").set("Authorization", `Bearer ${token}`).send({
        issuerDID: `did:ethr:${other.address.toLowerCase()}`, subjectDID: "did:ethr:" + addr,
        type: ["T"], credentialSubject: { a: 1 },
      });
      expect(res.status).toBe(403);
    });

    it("forbids confirming/indexing another address's DID", async () => {
      const me = Wallet.createRandom(), other = Wallet.createRandom();
      const token = await login(me);
      const res = await request(app).patch(`/api/did/${other.address}/confirm`).set("Authorization", `Bearer ${token}`).send({ did: "x", docCID: "y" });
      expect(res.status).toBe(403);
    });

    it("forbids pinning a DID document for someone else's address", async () => {
      const me = Wallet.createRandom(), other = Wallet.createRandom();
      const token = await login(me);
      const did = `did:ethr:${other.address.toLowerCase()}`;
      const res = await request(app).post("/api/did").set("Authorization", `Bearer ${token}`).send({ did, didDocument: { id: did } });
      expect(res.status).toBe(403);
    });
  });
});
