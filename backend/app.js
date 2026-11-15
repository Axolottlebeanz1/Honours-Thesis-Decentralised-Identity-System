const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { notFound, errorHandler } = require("./middleware/ErrorMiddleware");

const authRoutes = require("./routes/AuthRoutes");
const didRoutes = require("./routes/DIDRoutes");
const credentialRoutes = require("./routes/CredentialRoutes");

// Defines the Express app without connecting to the database or starting the server. 
const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));
if (process.env.NODE_ENV !== "test") app.use(morgan("dev"));

app.get("/api/health", (req, res) => res.json({ success: true, status: "ok", time: new Date().toISOString() }));

app.use("/api/auth", authRoutes);
app.use("/api/did", didRoutes);
app.use("/api/credentials", credentialRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
