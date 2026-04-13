// src/common/db.js

import mongoose from "mongoose";

let isConnected = false;

/**
 * Connect to MongoDB using MONGO_URI and MONGO_DB_NAME from .env
 * Reuses the existing connection if already connected.
 */
async function connectDB() {
  if (isConnected) {
    console.log("⚡ MongoDB already connected (reused connection).");
    return;
  }

  const isProd = process.env.NODE_ENV === "production";
  const uri = isProd ? process.env.MONGO_URI : process.env.MONGO_URI_LOCAL;
  const dbName = process.env.MONGO_DB_NAME;

  console.log(`🔌 Initializing database connection in [${isProd ? "PRODUCTION" : "LOCAL"}] mode...`);

  if (!uri) {
    console.error(`❌ Missing ${isProd ? "MONGO_URI" : "MONGO_URI_LOCAL"} in .env file.`);
    process.exit(1);
  }

  if (!dbName) {
    console.error("❌ Missing MONGO_DB_NAME in .env file.");
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, {
      dbName, // ✅ THIS is the important part
    });

    isConnected = true;

    console.log(
      `✅ MongoDB connected successfully (DB: ${dbName})`
    );
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  }
}

export { connectDB };
