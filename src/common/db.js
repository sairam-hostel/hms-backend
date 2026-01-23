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

  const uri = process.env.MONGO_URI;
  const dbName = process.env.MONGO_DB_NAME;

  if (!uri) {
    console.error("❌ Missing MONGO_URI in .env file.");
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
