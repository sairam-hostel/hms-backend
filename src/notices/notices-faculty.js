import express from "express";
import mongoose from "mongoose";

import verify from "../common/middleware.js";

const router = express.Router();


// ===============================================================
// 1. NOTICE SCHEMA ARRAY (20+ Detailed Fields)
// ===============================================================
const NoticeSchemaArray = [
  // IDENTIFIERS
  { key: "notice_id", type: "String", required: true, unique: true },
  { key: "faculty_author_id", type: "String", required: true },   // faculty who created

  // NOTICE CONTENT
  { key: "title", type: "String", required: true },
  { key: "message", type: "String", required: true },
  { key: "category", type: "String", enum: ["general", "hostel", "academic", "urgent", "event", "fee"], default: "general" },
  { key: "priority", type: "String", enum: ["low", "medium", "high", "critical"], default: "medium" },
  { key: "attachments", type: "Array", default: [] }, // e.g. file URLs

  // TARGETING OPTIONS
  { key: "target_course", type: "String" },  // BTech, MBA, etc.
  { key: "target_year", type: "String" },    // 1st, 2nd, 3rd, 4th
  { key: "target_department", type: "String" }, // CSE, ECE, AI&DS
  { key: "target_gender", type: "String", enum: ["male", "female", "all"], default: "all" },

  // TIMING
  { key: "valid_from", type: "Date" },
  { key: "valid_till", type: "Date" },
  { key: "expires", type: "Boolean", default: false },

  // VISIBILITY STATUS
  { key: "is_active", type: "Boolean", default: true },
  { key: "is_archived", type: "Boolean", default: false },

  // AUDIT TRAIL
  { key: "view_count", type: "Number", default: 0 },
  { key: "seen_by", type: "Array", default: [] },  // student IDs who saw this


  // METADATA
  { key: "created_at", type: "Date", default: "Date.now" },
  { key: "updated_at", type: "Date", default: "Date.now" }
];

// ===============================================================
// 2. TYPE MAP
// ===============================================================
const typeMap = {
  String: String,
  Number: Number,
  Date: Date,
  Array: Array,
  Boolean: Boolean
};

// ===============================================================
// 3. SCHEMA BUILDER
// ===============================================================
const schemaObject = {};

NoticeSchemaArray.forEach(field => {
  const f = { type: typeMap[field.type] };

  if (field.required) f.required = true;
  if (field.unique) f.unique = true;
  if (field.enum) f.enum = field.enum;
  if (field.default)
    f.default = field.default === "Date.now" ? Date.now : field.default;

  schemaObject[field.key] = f;
});

// ===============================================================
// 4. MONGOOSE SCHEMA + MODEL
// ===============================================================
const NoticeSchema = new mongoose.Schema(schemaObject, { versionKey: false });

NoticeSchema.pre("save", function () {
  this.updated_at = Date.now();
});

const Notice = mongoose.model("Notice", NoticeSchema);

// ===============================================================
// 5. HELPERS
// ===============================================================
const allowedCreateFields = [
  "title", "message", "category", "priority", "attachments",
  "target_course", "target_year", "target_department", "target_gender",
  "valid_from", "valid_till", "expires"
];

function sanitizeForCreate(obj) {
  const out = {};
  Object.keys(obj || {}).forEach(k => {
    if (allowedCreateFields.includes(k)) out[k] = obj[k];
  });
  return out;
}

const protectedUpdateFields = [
  "notice_id", "faculty_author_id", "created_at", "updated_at",
  "view_count", "seen_by", "edit_history"
];

// ===============================================================
// 6. FACULTY CONTROLS ONLY
// ===============================================================

// ---------------------------------------------
// CREATE NOTICE  (FACULTY ONLY)
// ---------------------------------------------
router.post("/", verify, async (req, res) => {
  if (req.user.role !== "faculty") {
    return res.status(403).json({ issue: "forbidden", message: "Only faculty can create notices" });
  }

  try {
    const incoming = sanitizeForCreate(req.body);

    const newNotice = await Notice.create({
      ...incoming,
      notice_id: crypto.randomUUID(),
      faculty_author_id: req.user.auth_user_id,
      created_at: Date.now(),
    });

    return res.json({ success: true, data: newNotice });

  } catch (err) {
    console.error("Notice Create Error:", err);
    res.status(500).json({ issue: "server_error", message: "Could not create notice" });
  }
});
// -------------------------------------------------------------
// FULL UPDATE (PUT) — replace allowed fields
// -------------------------------------------------------------
router.put("/:id", verify, async (req, res) => {
  if (req.user.role !== "faculty")
    return res.status(403).json({ issue: "forbidden" });

  try {
    const incoming = { ...req.body };

    // remove protected fields
    protectedUpdateFields.forEach(f => delete incoming[f]);

    incoming.updated_at = Date.now();

    const updated = await Notice.findOneAndUpdate(
      { notice_id: req.params.id },
      { $set: incoming },
      { new: true }
    );

    if (!updated)
      return res.status(404).json({ issue: "not_found" });

    return res.json({ success: true, data: updated });

  } catch (err) {
    console.error("Notice PUT Update Error:", err);
    return res.status(500).json({ issue: "server_error" });
  }
});

// -------------------------------------------------------------
// PARTIAL UPDATE (PATCH) — update only provided fields
// -------------------------------------------------------------
router.patch("/:id", verify, async (req, res) => {
  if (req.user.role !== "faculty")
    return res.status(403).json({ issue: "forbidden" });

  try {
    const updates = { ...req.body };

    // remove protected fields
    protectedUpdateFields.forEach(f => delete updates[f]);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        issue: "empty_update",
        message: "No valid fields provided to update"
      });
    }

    updates.updated_at = Date.now();

    const updated = await Notice.findOneAndUpdate(
      { notice_id: req.params.id },
      { $set: updates },
      { new: true }
    );

    if (!updated)
      return res.status(404).json({ issue: "not_found" });

    return res.json({ success: true, data: updated });

  } catch (err) {
    console.error("Notice PATCH Update Error:", err);
    return res.status(500).json({ issue: "server_error" });
  }
});


// ---------------------------------------------
// DELETE NOTICE (FACULTY ONLY)
// ---------------------------------------------
router.delete("/:id", verify, async (req, res) => {
  if (req.user.role !== "faculty")
    return res.status(403).json({ issue: "forbidden" });

  try {
    const out = await Notice.findOneAndDelete({ notice_id: req.params.id });

    if (!out)
      return res.status(404).json({ issue: "not_found" });

    res.json({ success: true, message: "Notice deleted" });

  } catch (err) {
    console.error("Notice Delete Error:", err);
    res.status(500).json({ issue: "server_error" });
  }
});

// -------------------------------------------------------------
// LIST ALL NOTICES (FACULTY VIEW) with Filters + Pagination
// -------------------------------------------------------------
router.get("/", verify, async (req, res) => {
  if (req.user.role !== "faculty") {
    return res.status(403).json({ issue: "forbidden" });
  }

  try {
    // ----------------------------
    // Pagination
    // ----------------------------
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    // ----------------------------
    // Filters
    // ----------------------------
    const filters = {};

    // category filtering
    if (req.query.category) {
      filters.category = req.query.category;
    }

    // priority filtering
    if (req.query.priority) {
      filters.priority = req.query.priority;
    }

    // active status filtering
    if (req.query.is_active) {
      filters.is_active = req.query.is_active === "true";
    }

    // archived status
    if (req.query.is_archived) {
      filters.is_archived = req.query.is_archived === "true";
    }

    // expiry filter
    if (req.query.expires) {
      filters.expires = req.query.expires === "true";
    }

    // date range
    if (req.query.from || req.query.to) {
      filters.created_at = {};
      if (req.query.from) filters.created_at.$gte = new Date(req.query.from);
      if (req.query.to) filters.created_at.$lte = new Date(req.query.to);
    }

    // keyword search (title + message)
    if (req.query.search) {
      const regex = new RegExp(req.query.search, "i");
      filters.$or = [
        { title: regex },
        { message: regex }
      ];
    }

    // ----------------------------
    // Sorting
    // ----------------------------
    const sortField = req.query.sort_by || "created_at";
    const sortOrder = req.query.order === "asc" ? 1 : -1;
    const sortObj = { [sortField]: sortOrder };

    // ----------------------------
    // Database Query
    // ----------------------------
    const list = await Notice.find(filters)
      .sort(sortObj)
      .skip(skip)
      .limit(limit);

    const total = await Notice.countDocuments(filters);

    res.json({
      success: true,
      pagination: {
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        total_items: total
      },
      filters_applied: filters,
      count: list.length,
      data: list
    });

  } catch (err) {
    console.error("Faculty Notice List Error:", err);
    res.status(500).json({ issue: "server_error" });
  }
});


// ---------------------------------------------
// GET A SINGLE NOTICE
// ---------------------------------------------
router.get("/:id", verify, async (req, res) => {
  if (req.user.role !== "faculty")
    return res.status(403).json({ issue: "forbidden" });

  try {
    const one = await Notice.findOne({ notice_id: req.params.id });

    if (!one)
      return res.status(404).json({ issue: "not_found" });

    res.json({ success: true, data: one });

  } catch (err) {
    console.error("Notice Fetch Error:", err);
    res.status(500).json({ issue: "server_error" });
  }
});

export default router;

export {
  Notice
};
