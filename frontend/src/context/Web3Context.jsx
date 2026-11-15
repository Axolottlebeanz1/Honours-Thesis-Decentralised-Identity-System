import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { BrowserProvider } from "ethers";
import { api } from "../services/api";

export const Web3Context = createContext(null);

const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || 31337);
const CHAIN_NAME = import.meta.env.VITE_CHAIN_NAME || "Localhost";

const TOKEN_KEY = "idsys_token";
const TOKEN_ADDRESS_KEY = "idsys_token_address";

// Manages the wallet connection and authentication state for the app.
// This includes the connected provider, signer, wallet address, network and session token. 
// Connecting a wallet is only the first step. 
// Users must also sign a one-time nonce so the backend can verify their wallet and issue a session token for protected requests.
export function Web3Provider({ children }) {
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [provider, setProvider] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [error, setError] = useState(null);

  const hasWallet = typeof window !== "undefined" && Boolean(window.ethereum);

  // Signs a one-time nonce with the connected wallet and sends the signature to the backend for verification. 
  // The returned JWT is then saved as the user's session token.
  const signIn = useCallback(async (browserProvider, address) => {
    setAuthenticating(true);
    setError(null);
    try {
      const signer = await browserProvider.getSigner();
      const { message } = await api.getNonce(address);
      const signature = await signer.signMessage(message);
      const { token: newToken } = await api.verifySignature(address, signature);

      localStorage.setItem(TOKEN_KEY, newToken);
      localStorage.setItem(TOKEN_ADDRESS_KEY, address.toLowerCase());
      setToken(newToken);
    } catch (err) {
      setError(err.message || "Sign-in failed");
      throw err;
    } finally {
      setAuthenticating(false);
    }
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_ADDRESS_KEY);
    setToken(null);
  }, []);

  const connect = useCallback(async () => {
    if (!hasWallet) {
      setError("No wallet found. Install MetaMask to continue.");
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const browserProvider = new BrowserProvider(window.ethereum);
      const accounts = await browserProvider.send("eth_requestAccounts", []);
      const network = await browserProvider.getNetwork();
      const address = accounts[0];

      setProvider(browserProvider);
      setAccount(address);
      setChainId(Number(network.chainId));

      // Keep the saved session only if it belongs to the connected address.
      // If the user is connecting for the first time or has switched accounts, request a new signature to create a session for the current wallet.
      const storedAddress = localStorage.getItem(TOKEN_ADDRESS_KEY);
      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (storedToken && storedAddress === address.toLowerCase()) {
        setToken(storedToken);
      } else {
        await signIn(browserProvider, address);
      }
    } catch (err) {
      setError(err.message || "Failed to connect wallet");
    } finally {
      setConnecting(false);
    }
  }, [hasWallet, signIn]);

  const disconnect = useCallback(() => {
    setAccount(null);
    setProvider(null);
    setChainId(null);
    clearSession();
  }, [clearSession]);

  useEffect(() => {
    if (!hasWallet) return;
    // When the user switches accounts, clear the existing session because its token was issued for the previous wallet. A new sign-in is required.
    const handleAccountsChanged = (accounts) => {
      const next = accounts[0] || null;
      setAccount(next);
      clearSession();
    };
    const handleChainChanged = (hexChainId) => setChainId(parseInt(hexChainId, 16));

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);
    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, [hasWallet, clearSession]);

  const isWrongNetwork = Boolean(chainId) && chainId !== CHAIN_ID;
  const isConnected = Boolean(account);
  const isAuthenticated = isConnected && Boolean(token);

  const value = useMemo(
    () => ({
      account, provider, chainId, connecting, authenticating, error, hasWallet,
      isConnected, isAuthenticated, isWrongNetwork, expectedChain: { id: CHAIN_ID, name: CHAIN_NAME },
      connect, disconnect,
      signIn: () => signIn(provider, account),
    }),
    [account, provider, chainId, connecting, authenticating, error, hasWallet,
      isConnected, isAuthenticated, isWrongNetwork, connect, disconnect, signIn]
  );

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>;
}
