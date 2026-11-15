import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Home from "./pages/Home.jsx";
import CreateDID from "./pages/CreateDID.jsx";
import IssueCredential from "./pages/IssueCredential.jsx";
import VerifyCredential from "./pages/VerifyCredential.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Security from "./pages/Security.jsx";

export default function App() {
  return (
    <div className="app-shell">
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/verify" element={<VerifyCredential />} />
        <Route path="/security" element={<Security />} />
        <Route
          path="/create-did"
          element={<ProtectedRoute><CreateDID /></ProtectedRoute>}
        />
        <Route
          path="/issue"
          element={<ProtectedRoute><IssueCredential /></ProtectedRoute>}
        />
        <Route
          path="/dashboard"
          element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
        />
      </Routes>
    </div>
  );
}
