const { ethers, artifacts } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Deploys DIDRegistry first, followed by CredentialRegistry, which needs the DIDRegistry address.
// Saves both contract ABIs in the frontend so the application can use the deployed contracts.
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const DIDRegistry = await ethers.getContractFactory("DIDRegistry");
  const didRegistry = await DIDRegistry.deploy();
  await didRegistry.waitForDeployment();
  console.log("DIDRegistry deployed to:", await didRegistry.getAddress());

  const CredentialRegistry = await ethers.getContractFactory("CredentialRegistry");
  const credentialRegistry = await CredentialRegistry.deploy(await didRegistry.getAddress());
  await credentialRegistry.waitForDeployment();
  console.log("CredentialRegistry deployed to:", await credentialRegistry.getAddress());

  const outDir = path.join(__dirname, "..", "frontend", "src", "contracts");
  fs.mkdirSync(outDir, { recursive: true });

  for (const name of ["DIDRegistry", "CredentialRegistry"]) {
    const artifact = await artifacts.readArtifact(name);
    fs.writeFileSync(
      path.join(outDir, `${name}.json`),
      JSON.stringify({ contractName: name, abi: artifact.abi }, null, 2)
    );
  }

  console.log("\nAdd these to frontend/.env and backend/.env:");
  console.log(`VITE_DID_REGISTRY_ADDRESS=${await didRegistry.getAddress()}`);
  console.log(`VITE_CREDENTIAL_REGISTRY_ADDRESS=${await credentialRegistry.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
