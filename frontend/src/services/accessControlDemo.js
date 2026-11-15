import { Contract, JsonRpcProvider } from "ethers";
import didRegistryArtifact from "../contracts/DIDRegistry.json";

const RPC_URL = import.meta.env.VITE_RPC_URL || "http://127.0.0.1:8545";
const DID_REGISTRY_ADDRESS = import.meta.env.VITE_DID_REGISTRY_ADDRESS;

// Extracts the readable revert reason from an ethers or Hardhat error.
function revertReason(err) {
  if (err?.reason) return err.reason;
  const raw = [err?.shortMessage, err?.message, err?.info?.error?.message].filter(Boolean).join(" ");
  const m = raw.match(/reason string '([^']+)'/);
  return m ? m[1] : raw.slice(0, 200) || "unknown error";
}

// Runs a function that should fail and checks whether the error contains the expected message.
async function expectRevert(fn, expected) {
  try {
    await fn();
    return { passed: false, actual: "Call SUCCEEDED (it should have reverted)" };
  } catch (err) {
    const actual = revertReason(err);
    return { passed: actual.includes(expected), actual };
  }
}

// Runs the same access-control scenarios covered by test/DIDRegistry.test.js, but against the DIDRegistry deployed on the local Hardhat node.
// - Uses the last three unlocked Hardhat accounts so they do not interfere with the accounts normally used in MetaMask.
// - Attack attempts use staticCall, so the contract's revert reason can be checked without sending a transaction.
// - Setup actions, such as registering and deactivating a DID, use real transactions.
export async function runAccessControlSuite(onProgress = () => {}) {
  const provider = new JsonRpcProvider(RPC_URL, undefined, { cacheTimeout: -1 });
  const results = [];
  const push = (r) => { results.push(r); onProgress([...results]); };

  const accounts = await provider.listAccounts();
  if (accounts.length < 3) throw new Error("Need at least 3 unlocked accounts (run against `hardhat node`).");
  const [victim, attacker, fresh] = accounts.slice(-3);

  const registry = new Contract(DID_REGISTRY_ADDRESS, didRegistryArtifact.abi, provider);
  const as = (signer) => registry.connect(signer);
  const victimDid = `did:ethr:${victim.address.toLowerCase()}`;

  let snapshotId;
  try {
    snapshotId = await provider.send("evm_snapshot", []);
  } catch {
    throw new Error("This demo needs the local Hardhat node (evm_snapshot not available).");
  }

  try {
    // Register a DID for the victim before running the attack scenarios.
    await (await as(victim).registerDID(victimDid, "cid-original")).wait();
    const before = await registry.resolveDID(victim.address);

    // 1. Try to register a second DID using an address that already has one.
    push({
      id: 1, title: "Register a second DID from the same address",
      actor: "victim (already has a DID)", call: 'registerDID("did:ethr:…", "cid-2")',
      expected: "address already has a registered DID",
      ...(await expectRevert(() => as(victim).registerDID.staticCall(victimDid, "cid-2"), "already has a registered DID")),
    });

    // 2. Try to update a DID using an address that has no registered DID.
    push({
      id: 2, title: "Update another address's DID",
      actor: "attacker (no DID of their own)", call: 'updateDID("cid-hijacked")',
      expected: "caller has no registered DID",
      ...(await expectRevert(() => as(attacker).updateDID.staticCall("cid-hijacked"), "caller has no registered DID")),
    });

    // 3. Try to deactivate a DID using an address that has no registered DID.
    push({
      id: 3, title: "Deactivate another address's DID",
      actor: "attacker (no DID of their own)", call: "deactivateDID()",
      expected: "caller has no registered DID",
      ...(await expectRevert(() => as(attacker).deactivateDID.staticCall(), "caller has no registered DID")),
    });

    // 4. Try to resolve an address that has not registered a DID.
    push({
      id: 4, title: "Resolve an address with no DID",
      actor: "anyone", call: "resolveDID(<unregistered address>)",
      expected: "no DID registered for this address",
      ...(await expectRevert(() => registry.resolveDID(attacker.address), "no DID registered for this address")),
    });

    // 5. Try to register a DID with an empty DID string.
    push({
      id: 5, title: "Register with an empty DID string",
      actor: "new address", call: 'registerDID("", "cid-1")',
      expected: "empty DID",
      ...(await expectRevert(() => as(fresh).registerDID.staticCall("", "cid-1"), "empty DID")),
    });

    // 6. Try to register a DID without providing a document CID.
    push({
      id: 6, title: "Register with an empty CID",
      actor: "new address", call: 'registerDID("did:ethr:…", "")',
      expected: "empty docCID",
      ...(await expectRevert(() => as(fresh).registerDID.staticCall("did:ethr:test", ""), "empty docCID")),
    });

    // 7. Deactivate the victim's DID, then try to update it.
    await (await as(victim).deactivateDID()).wait();
    push({
      id: 7, title: "Update a DID after it has been deactivated",
      actor: "victim (DID deactivated)", call: 'updateDID("cid-3")',
      expected: "DID deactivated",
      ...(await expectRevert(() => as(victim).updateDID.staticCall("cid-3"), "DID deactivated")),
    });

    // 8. Check that write functions use the caller's wallet address rather than accepting an address supplied in the request.
    const writeFns = didRegistryArtifact.abi.filter(
      (f) => f.type === "function" && f.stateMutability !== "view" && f.stateMutability !== "pure"
    );
    const addressParams = writeFns.flatMap((f) => f.inputs.filter((i) => i.type === "address").map(() => f.name));
    const after = await registry.resolveDID(victim.address);
    push({
      id: 8, title: "Ownership is taken from the caller's wallet, not the request",
      actor: "static check + state comparison",
      call: writeFns.map((f) => `${f.name}(${f.inputs.map((i) => i.type).join(", ")})`).join("  ·  "),
      expected: "no state-changing function accepts an address; victim's record unchanged by attacker",
      passed: addressParams.length === 0 && before.docCID === "cid-original" && after.docCID === "cid-original",
      actual: addressParams.length === 0
        ? `No write function takes an address argument; record CID still "${after.docCID}" after the attacks`
        : `Address parameter found on: ${addressParams.join(", ")}`,
    });
  } finally {
    // Restore the original chain state so the demo does not leave any test records or changes behind.
    if (snapshotId) await provider.send("evm_revert", [snapshotId]).catch(() => {});
    provider.destroy();
  }

  return results;
}
