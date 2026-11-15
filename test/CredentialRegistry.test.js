const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployRegistries } = require("./utils/fixtures");

describe("CredentialRegistry", function () {
  async function registerIssuerDID({ issuer, didRegistry }) {
    const issuerDID = `did:ethr:${issuer.address.toLowerCase()}`;
    await didRegistry.connect(issuer).registerDID(issuerDID, "cid-issuer");
    return issuerDID;
  }

  it("registers a credential hash under the caller's address as issuer", async function () {
    const ctx = await deployRegistries();
    const { issuer, credentialRegistry } = ctx;
    await registerIssuerDID(ctx);

    const credentialHash = ethers.keccak256(ethers.toUtf8Bytes("vc-payload-1"));

    await expect(credentialRegistry.connect(issuer).registerCredential(credentialHash))
      .to.emit(credentialRegistry, "CredentialRegistered");

    const record = await credentialRegistry.getRecord(credentialHash);
    expect(record.issuer).to.equal(issuer.address);
    expect(record.issued).to.equal(true);
    expect(record.revoked).to.equal(false);

    expect(await credentialRegistry.isRevoked(credentialHash)).to.equal(false);
  });

  it("rejects registration from a caller with no active DID", async function () {
    const ctx = await deployRegistries();
    const { subject, credentialRegistry } = ctx;

    const credentialHash = ethers.keccak256(ethers.toUtf8Bytes("vc-payload-2"));

    await expect(
      credentialRegistry.connect(subject).registerCredential(credentialHash)
    ).to.be.revertedWith("CredentialRegistry: caller has no active DID");
  });

  it("only allows the original issuer to revoke, and marks isRevoked() true afterward", async function () {
    const ctx = await deployRegistries();
    const { issuer, other, credentialRegistry, didRegistry } = ctx;
    await registerIssuerDID(ctx);

    // give `other` a DID too, so it can be proved that they still can't revoke someone else's credential
    await didRegistry.connect(other).registerDID(`did:ethr:${other.address.toLowerCase()}`, "cid-other");

    const credentialHash = ethers.keccak256(ethers.toUtf8Bytes("vc-payload-3"));
    await credentialRegistry.connect(issuer).registerCredential(credentialHash);

    await expect(credentialRegistry.connect(other).revokeCredential(credentialHash)).to.be.revertedWith(
      "CredentialRegistry: caller is not the issuer"
    );

    await credentialRegistry.connect(issuer).revokeCredential(credentialHash);
    expect(await credentialRegistry.isRevoked(credentialHash)).to.equal(true);
  });

  it("rejects revoking an unregistered credential hash", async function () {
    const ctx = await deployRegistries();
    const { issuer, credentialRegistry } = ctx;
    await registerIssuerDID(ctx);

    const unregisteredHash = ethers.keccak256(ethers.toUtf8Bytes("never-registered"));
    await expect(credentialRegistry.connect(issuer).revokeCredential(unregisteredHash)).to.be.revertedWith(
      "CredentialRegistry: credential not registered"
    );
  });
});
