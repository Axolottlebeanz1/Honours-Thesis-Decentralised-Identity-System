import { Navigate } from "react-router-dom";
import { useWallet } from "../hooks/useWallet";

// Only allows users with an authenticated wallet session to access the route. 
// Connecting a wallet alone is not enough. The user must also complete the nonce and signature verification process.
export default function ProtectedRoute({ children }) {
  const { isAuthenticated } = useWallet();
  if (!isAuthenticated) return <Navigate to="/?connect=1" replace />;
  return children;
}
