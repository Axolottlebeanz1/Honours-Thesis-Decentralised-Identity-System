import { useContext } from "react";
import { Web3Context } from "../context/Web3Context";

// Provides components with access to the shared wallet and authentication state.
export function useWallet() {
  const ctx = useContext(Web3Context);
  if (!ctx) throw new Error("useWallet must be used within a Web3Provider");
  return ctx;
}
