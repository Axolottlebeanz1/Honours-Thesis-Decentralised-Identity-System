const jwt = require("jsonwebtoken");
const config = require("../config");

// Checks whether the request includes a valid session token.
// The wallet signature is verified earlier in services/signature.service.js.
// This middleware verifies the JWT issued after successful wallet authentication and makes the user's details available through req.user.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ success: false, message: "Missing auth token" });

  try {
    req.user = jwt.verify(token, config.jwtSecret);
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

module.exports = { requireAuth };
