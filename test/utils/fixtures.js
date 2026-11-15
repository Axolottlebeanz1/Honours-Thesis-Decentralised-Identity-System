const { ethers } = require("hardhat");

async function deployRegistries() {
  const [owner, issuer, subject, other] = await ethers.getSigners();

  const DIDRegistry = await ethers.getContractFactory("DIDRegistry");
  const didRegistry = await DIDRegistry.deploy();

  const CredentialRegistry = await ethers.getContractFactory("CredentialRegistry");
  const credentialRegistry = await CredentialRegistry.deploy(await didRegistry.getAddress());

  return { owner, issuer, subject, other, didRegistry, credentialRegistry };
}

module.exports = { deployRegistries };
