import { NavLink } from "react-router-dom";
import WalletConnectButton from "./WalletConnectButton.jsx";

export default function Navbar() {
  return (
    <header className="navbar">
      <div className="navbar-brand">
        <span className="seal" style={{ width: 30, height: 30, fontSize: "0.6rem" }}>ID</span>
        IDSys
      </div>
      <nav className="navbar-links">
        <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>Home</NavLink>
        <NavLink to="/create-did" className={({ isActive }) => (isActive ? "active" : "")}>Create DID</NavLink>
        <NavLink to="/issue" className={({ isActive }) => (isActive ? "active" : "")}>Issue</NavLink>
        <NavLink to="/verify" className={({ isActive }) => (isActive ? "active" : "")}>Verify</NavLink>
        <NavLink to="/security" className={({ isActive }) => (isActive ? "active" : "")}>Security</NavLink>
        <NavLink to="/dashboard" className={({ isActive }) => (isActive ? "active" : "")}>Dashboard</NavLink>
      </nav>
      <WalletConnectButton />
    </header>
  );
}
