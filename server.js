require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { connectDB } = require("./src/common/db");
const authMiddleware = require("./src/common/middleware");
const routeDefs = require("./src/common/routes.js");
const jwt = require("jsonwebtoken");

const app = express();
app.set("etag", "strong");
// -------------------- Middleware --------------------
app.use(express.json());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
  })
);

// -------------------------------------------------------------
// ONE-LINE GLOBAL LOGGER (every API call)
// -------------------------------------------------------------
app.use((req, res, next) => {
  const start = Date.now();
  const originalSend = res.send;

  res.send = function (data) {
    const duration = Date.now() - start;

    let user = "public";
    try {
      const header = req.headers["authorization"];
      if (header) {
        const token = header.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        user = decoded.auth_user_id || decoded.role || "public";
      }
    } catch (_) {}

    const logLine =
      `[${new Date().toISOString()}] ` +
      `${req.method} ${req.originalUrl} ` +
      `${res.statusCode} ` +
      `${duration}ms ` +
      `user=${user} ` +
      `query=${JSON.stringify(req.query)} ` +
      `body=${JSON.stringify(req.body)}`;

    console.log(logLine);

    return originalSend.apply(this, arguments);
  };

  next();
});

// -------------------------------------------------------------
// UNIVERSAL SAFE ROUTER LOADER
// -------------------------------------------------------------
function loadSafeRouter(modulePath, prefix) {
  try {
    const mod = require(modulePath);

    if (typeof mod === "function") return mod;
    if (mod && typeof mod.router === "function") return mod.router;
    if (mod && typeof mod.default === "function") return mod.default;
  } catch (err) {
    console.warn(`⚠️ Could not load ${modulePath}: ${err.message}`);
  }

  const stub = express.Router();
  stub.use((req, res) => {
    return res.status(501).json({
      issue: "module_not_implemented",
      prefix,
      path: modulePath,
      message: `Module ${modulePath} is not implemented or not exporting a router.`,
    });
  });
  return stub;
}

// -------------------------------------------------------------
// PUBLIC ROUTES (no token required)
// -------------------------------------------------------------
const publicPrefixes = [
  "/bf1/auth",
  "/bs1/auth",
];

// -------------------------------------------------------------
// MOUNT ALL ROUTES
// -------------------------------------------------------------
routeDefs.forEach((r) => {
  const router = loadSafeRouter(r.path, r.prefix);
  const isPublic = publicPrefixes.some((pub) => r.prefix.startsWith(pub));

  if (isPublic) {
    app.use(r.prefix, router);
    console.log(`🔓 Public Route Mounted: ${r.prefix}`);
  } else {
    app.use(r.prefix, authMiddleware, router);
    console.log(`🔐 Protected Route Mounted: ${r.prefix}`);
  }
});

// -------------------------------------------------------------
// RUN SERVER
// -------------------------------------------------------------
const PORT = process.env.PORT || 3000;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
});
