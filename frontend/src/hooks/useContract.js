import { useMemo } from "react";
import { Contract } from "ethers";
import { useWallet } from "./useWallet";
import didRegistryArtifact from "../contracts/DIDRegistry.json";
import credentialRegistryArtifact from "../contracts/CredentialRegistry.json";

const DID_REGISTRY_ADDRESS = import.meta.env.VITE_DID_REGISTRY_ADDRESS;
const CREDENTIAL_REGISTRY_ADDRESS = import.meta.env.VITE_CREDENTIAL_REGISTRY_ADDRESS;

// Creates the DID and credential contract instances used by the app.
// Returns null instances until a wallet provider is available.
export function useContracts() {
  const { provider } = useWallet();

  return useMemo(() => {
    if (!provider) return { didRegistry: null, credentialRegistry: null };

    const signerOrProvider = provider;
    return {
      didRegistry: new Contract(DID_REGISTRY_ADDRESS, didRegistryArtifact.abi, signerOrProvider),
      credentialRegistry: new Contract(CREDENTIAL_REGISTRY_ADDRESS, credentialRegistryArtifact.abi, signerOrProvider),
    };
  }, [provider]);
}
