import express from "express";
import mongoose from "mongoose";

import { Faculty } from "../accounts/creation-faculty.js";
import { Student } from "../accounts/creation-students.js";

const router = express.Router();

// ==================================================
// 🔐 STATIC ADMIN PASSWORD (CHANGE THIS)
// ==================================================
const ADMIN_DELETE_PASSWORD = "SUPER_ADMIN_123";

// ==================================================
// 🔐 PASSWORD GUARD (BODY-BASED)
// ==================================================
function verifyAdminPassword(req, res, next) {
  const { admin_password } = req.body;

  if (!admin_password) {
    return res.status(401).json({
      issue: "missing_admin_password",
      message: "admin_password is required"
    });
  }

  if (admin_password !== ADMIN_DELETE_PASSWORD) {
    return res.status(403).json({
      issue: "invalid_admin_password",
      message: "Invalid admin password"
    });
  }

  next();
}

// ==================================================
// DELETE USER BY EMAIL (PROTECTED)
// ==================================================
router.delete("/user-by-email", verifyAdminPassword, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        issue: "missing_fields",
        message: "email is required"
      });
    }

    const normalizedEmail = email.toLowerCase();

    let deletedUser = await Faculty.findOneAndDelete({
      email: normalizedEmail
    });

    if (!deletedUser) {
      deletedUser = await Student.findOneAndDelete({
        email: normalizedEmail
      });
    }

    if (!deletedUser) {
      return res.status(404).json({
        issue: "not_found",
        message: "No such user found"
      });
    }

    return res.json({
      success: true,
      message: "User deleted",
      data: {
        auth_user_id: deletedUser.auth_user_id,
        email: deletedUser.email,
        name: deletedUser.name
      }
    });

  } catch (err) {
    console.error("Delete User Error:", err);
    return res.status(500).json({
      issue: "server_error",
      message: "Internal server error"
    });
  }
});

// ==================================================
// DELETE TABLES / COLLECTIONS (PROTECTED)
// ==================================================
router.delete("/delete-tables", verifyAdminPassword, async (req, res) => {
  try {
    if (process.env.ALLOW_DB_RESET !== "true") {
      return res.status(403).json({
        issue: "db_reset_disabled",
        message: "Database reset is disabled"
      });
    }

    const { all, collections } = req.body;

    // 🔥 Delete ALL collections
    if (all === true) {
      const deleted = await deleteAllCollections();
      return res.json({
        success: true,
        mode: "all",
        deleted_collections: deleted
      });
    }

    // 🎯 Delete specific collections
    if (Array.isArray(collections) && collections.length > 0) {
      const deleted = await deleteSpecificCollections(collections);

      if (deleted.length === 0) {
        return res.status(404).json({
          issue: "not_found",
          message: "No matching collections found"
        });
      }

      return res.json({
        success: true,
        mode: "partial",
        deleted_collections: deleted
      });
    }

    return res.status(400).json({
      issue: "invalid_request",
      message: "Provide { all: true } or { collections: [...] }"
    });

  } catch (err) {
    console.error("Delete Collections Error:", err);
    return res.status(500).json({
      issue: "server_error",
      message: "Internal server error"
    });
  }
});

// ==================================================
// DB HELPERS (PRIVATE)
// ==================================================
async function deleteAllCollections() {
  const collections = await mongoose.connection.db.collections();

  for (const collection of collections) {
    await collection.deleteMany({});
  }

  return collections.map(c => c.collectionName);
}

async function deleteSpecificCollections(names = []) {
  const deleted = [];

  for (const name of names) {
    const collection = mongoose.connection.db.collection(name);
    const exists = await collection.countDocuments().catch(() => null);

    if (exists !== null) {
      await collection.deleteMany({});
      deleted.push(name);
    }
  }

  return deleted;
}

// ==================================================
// ✅ EXPORT ROUTER ONLY
// ==================================================
export default router;
