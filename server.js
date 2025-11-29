require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { connectDB } = require("./src/common/db");
const authMiddleware = require("./src/common/middleware");
const routeDefs = require("./src/common/routes.js");
const app = express();

// -------------------- Middleware --------------------
app.use(express.json());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
  })
);

// -------------------- UNIVERSAL SAFE ROUTER LOADER --------------------
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

// -------------------- LOAD ROUTES FROM routes.js --------------------


// Public endpoints (no JWT required)
const publicPrefixes = [
  "/bf1/auth",
  "/bs1/auth",
  // "/bf1/accounts",
  // "/b1/delete-auth",
];

// -------------------- MOUNT ROUTES --------------------
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

// -------------------- RUN SERVER AFTER DB CONNECT --------------------
const PORT = process.env.PORT || 3000;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
});
