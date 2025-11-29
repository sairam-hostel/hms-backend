// src/common/db.js

const mongoose = require("mongoose");

let isConnected = false;

/**
 * Connect to MongoDB using MONGO_URI from .env
 * Reuses the existing connection if already connected.
 */
async function connectDB() {
  if (isConnected) {
    console.log("⚡ MongoDB already connected (reused connection).");
    return;
  }

  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("❌ Missing MONGO_URI in .env file.");
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);   // ✅ CLEAN for Mongoose 7/8

    isConnected = true;
    console.log("✅ MongoDB connected successfully (via /src/common/db.js)");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  }
}

module.exports = { connectDB };
