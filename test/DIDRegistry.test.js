const { expect } = require("chai");
const { deployRegistries } = require("./utils/fixtures");

describe("DIDRegistry", function () {
  it("registers a new DID keyed by the caller's wallet address", async function () {
    const { issuer, didRegistry } = await deployRegistries();
    const did = `did:ethr:${issuer.address.toLowerCase()}`;

    await expect(didRegistry.connect(issuer).registerDID(did, "cid-1"))
      .to.emit(didRegistry, "DIDRegistered");

    const record = await didRegistry.resolveDID(issuer.address);
    expect(record.owner).to.equal(issuer.address);
    expect(record.did).to.equal(did);
    expect(record.active).to.equal(true);
  });

  it("rejects a second registration from the same address", async function () {
    const { issuer, didRegistry } = await deployRegistries();
    const did = `did:ethr:${issuer.address.toLowerCase()}`;
    await didRegistry.connect(issuer).registerDID(did, "cid-1");

    await expect(didRegistry.connect(issuer).registerDID(did, "cid-2")).to.be.revertedWith(
      "DIDRegistry: address already has a registered DID"
    );
  });

  it("only lets the owning address update or deactivate its own DID", async function () {
    const { issuer, other, didRegistry } = await deployRegistries();
    const did = `did:ethr:${issuer.address.toLowerCase()}`;
    await didRegistry.connect(issuer).registerDID(did, "cid-1");

    await expect(didRegistry.connect(other).updateDID("cid-2")).to.be.revertedWith(
      "DIDRegistry: caller has no registered DID"
    );

    await didRegistry.connect(issuer).updateDID("cid-2");
    const updated = await didRegistry.resolveDID(issuer.address);
    expect(updated.docCID).to.equal("cid-2");

    await didRegistry.connect(issuer).deactivateDID();
    const deactivated = await didRegistry.resolveDID(issuer.address);
    expect(deactivated.active).to.equal(false);
  });

  it("reverts when resolving an address with no registered DID", async function () {
    const { other, didRegistry } = await deployRegistries();
    await expect(didRegistry.resolveDID(other.address)).to.be.revertedWith(
      "DIDRegistry: no DID registered for this address"
    );
  });

  it("reports hasActiveDID correctly, including after deactivation", async function () {
    const { issuer, other, didRegistry } = await deployRegistries();
    const did = `did:ethr:${issuer.address.toLowerCase()}`;

    expect(await didRegistry.hasActiveDID(other.address)).to.equal(false);

    await didRegistry.connect(issuer).registerDID(did, "cid-1");
    expect(await didRegistry.hasActiveDID(issuer.address)).to.equal(true);

    await didRegistry.connect(issuer).deactivateDID();
    expect(await didRegistry.hasActiveDID(issuer.address)).to.equal(false);
  });
});
