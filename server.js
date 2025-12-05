require("dotenv").config();

const cors = require("cors");
const express = require("express");
const jwt = require("jsonwebtoken");
const { connectDB } = require("./src/common/db");
const routeDefs = require("./src/common/routes.js");
const authMiddleware = require("./src/common/middleware");
const { getStatusPage } = require("./src/common/statuspage.js");
const serverStart = Date.now();
const app = express();
app.set("etag", "strong");
// -------------------- Middleware --------------------
app.use(express.json());
app.use(
  cors({
    origin: function (origin, callback) {
      const allowed = process.env.CORS_ORIGIN.split(",").map(o => o.trim());

      if (!origin) return callback(null, true); // allow Postman, backend calls

      if (allowed.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS blocked: " + origin));
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
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


app.get("/a1/status", (req, res) => {
  const username = process.env.USERNAME || "unknown";
  // Optionally, pass additional info
  const html = getStatusPage(username, { nodeVersion: process.version, time: new Date().toISOString() });
  res.set("Content-Type", "text/html");
  res.send(html);
});
// -------------------------------------------------------------
// RUN SERVER
// -------------------------------------------------------------
const PORT = process.env.PORT || 8000;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
});

