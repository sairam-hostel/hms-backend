import dotenv from "dotenv";
dotenv.config();

import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";

import { connectDB } from "./src/common/db.js";
import routeDefs from "./src/common/routes.js";
import authMiddleware from "./src/common/middleware.js";
import { getStatusPage } from "./src/common/statuspage.js";


const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("etag", "strong");
// -------------------- Middleware --------------------

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
async function loadSafeRouter(modulePath, prefix) {
  try {
    const mod = await import(
      new URL(modulePath, import.meta.url)
    );

    if (typeof mod.default === "function") return mod.default;
    if (mod.router && typeof mod.router === "function") return mod.router;

    throw new Error("No router export found");
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
  "/b1/delete",
  "/bf1/review"
  // "/bf1/accounts/students",
  // "/bf1/accounts/faculty",
  
];

// -------------------------------------------------------------
// MOUNT ALL ROUTES
// -------------------------------------------------------------
for (const r of routeDefs) {
  const router = await loadSafeRouter(r.path, r.prefix);

  if (typeof router !== "function") {
    console.warn(`⚠️ Invalid router for ${r.path}`);
    continue;
  }

  const isPublic = publicPrefixes.some((pub) =>
    r.prefix.startsWith(pub)
  );

  if (isPublic) {
    app.use(r.prefix, router);
    console.log(`🔓 Public Route Mounted: ${r.prefix}`);
  } else {
    app.use(r.prefix, authMiddleware, router);
    console.log(`🔐 Protected Route Mounted: ${r.prefix}`);
  }
}



app.get("/a1/status", (req, res) => {
  const username = "backend team";
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

