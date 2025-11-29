// src/leave-outpass/leave-outpass.js

const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const crypto = require("crypto");

// ===============================================================
// 1. LEAVE / OUTPASS SCHEMA ARRAY  (Highly detailed)
// ===============================================================
const LeaveOutpassSchemaArray = [
  // ==========================================================
  // IDENTIFIERS
  // ==========================================================
  { key: "request_id", type: "String", required: true, unique: true }, 
  { key: "auth_user_id", type: "String", required: true },            // student
  { key: "faculty_reviewer_id", type: "String" },                     // faculty approving

  // ==========================================================
  // REQUEST TYPE
  // ==========================================================
  { key: "type", type: "String", enum: ["leave", "outpass"], required: true },

  // ==========================================================
  // REQUEST DETAILS
  // ==========================================================
  { key: "request_reason", type: "String" },
  { key: "place_to_visit", type: "String" },
  { key: "address_details", type: "String" },
  { key: "mode_of_transport", type: "String" },

  // ==========================================================
  // DATE & TIME
  // ==========================================================
  { key: "from_date", type: "Date" },
  { key: "to_date", type: "Date" },
  { key: "return_date", type: "Date" },
  { key: "expected_in_time", type: "String" },

  // ==========================================================
  // CONTACT DETAILS
  // ==========================================================
  { key: "parent_phone", type: "String" },
  { key: "guardian_phone", type: "String" },
  { key: "local_guardian_name", type: "String" },
  { key: "local_guardian_phone", type: "String" },

  // ==========================================================
  // APPROVAL FLOW & STATUS
  // ==========================================================
  { key: "status", type: "String", enum: ["pending", "approved", "rejected", "cancelled", "completed", "overdue"], default: "pending" },
  { key: "faculty_note", type: "String" },
  { key: "admin_note", type: "String" },
  { key: "approved_at", type: "Date" },
  { key: "rejected_at", type: "Date" },
  { key: "location_status", type: "String",enum: ["outside", "inside"], default: "inside" },

  // ==========================================================
  // QR / BARCODE SECURITY
  // ==========================================================
  { key: "qr_payload", type: "String" },      // base64
  { key: "qr_signature", type: "String" },    // HMAC SHA256
  { key: "qr_generated_at", type: "Date" },

  // ==========================================================
  // GATE LOGS (OUT & IN)
  // ==========================================================
  { key: "gate_out_time", type: "Date" },
  { key: "gate_in_time", type: "Date" },
  { key: "gate_verified_by", type: "String" }, // security staff ID

  // ==========================================================
  // AUDIT TRAIL
  // ==========================================================
  { key: "action_history", type: "Array", default: [] },

  // ==========================================================
  // METADATA
  // ==========================================================
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
// 3. CONVERT SCHEMA ARRAY → SCHEMA OBJECT
// ===============================================================
const schemaObject = {};

LeaveOutpassSchemaArray.forEach(f => {
  const field = { type: typeMap[f.type] };

  if (f.required) field.required = true;
  if (f.unique) field.unique = true;
  if (f.enum) field.enum = f.enum;
  if (f.default) field.default = f.default === "Date.now" ? Date.now : f.default;

  schemaObject[f.key] = field;
});

// ===============================================================
// 4. MONGOOSE SCHEMA + MODEL
// ===============================================================
const LeaveOutpassSchema = new mongoose.Schema(schemaObject, { versionKey: false });

LeaveOutpassSchema.pre("save", async function () {
  this.updated_at = Date.now();
});
const LeaveOutpass = mongoose.model("LeaveOutpass", LeaveOutpassSchema);


// ===============================================================
// 5. HELPERS (SAME STYLE AS FACULTY)
// ===============================================================
const allowedPublicFields = [
  "type", "request_reason", "place_to_visit", "address_details",
  "mode_of_transport", "from_date", "to_date", "return_date",
  "expected_in_time", "parent_phone", "guardian_phone",
  "local_guardian_name", "local_guardian_phone"
];

function sanitizeForCreate(obj) {
  const out = {};
  Object.keys(obj || {}).forEach(k => {
    if (allowedPublicFields.includes(k)) out[k] = obj[k];
  });
  return out;
}

function hiddenProjection() {
  return {
    otp_code: 0,
    reset_token: 0
  };
}

// Fields student cannot manually update
const protectedUpdateFields = [
  "auth_user_id", "faculty_reviewer_id", "status", "request_id",
  "qr_payload", "qr_signature", "qr_generated_at",
  "gate_out_time", "gate_in_time", "action_history",
  "approved_at", "rejected_at", "created_at", "updated_at"
];




/* ============================================================
   1. CREATE LEAVE/OUTPASS REQUEST (STUDENT)
   ============================================================ */
router.post("/request", async (req, res) => {
  try {
    const userId = req.user?.auth_user_id;
    if (!userId) {
      return res.status(401).json({ issue: "unauthorized", message: "Invalid token" });
    }

    const data = sanitizeForCreate(req.body);

    data.request_id = crypto.randomUUID();
    data.auth_user_id = userId;
    data.status = "pending";
    data.created_at = Date.now();
    data.updated_at = Date.now();

    const doc = await LeaveOutpass.create(data);

    return res.json({ success: true, message: "Request submitted", data: doc });

  } catch (err) {
    console.error("Leave/Create Error →", err);
    return res.status(500).json({ issue: "server_error", message: "Something went wrong" });
  }
});
/* ============================================================
   2. GET ALL REQUESTS BY STUDENT (WITH FILTERS)
   ============================================================ */
router.get("/", async (req, res) => {
  try {
    const userId = req.user?.auth_user_id;

    const q = { auth_user_id: userId };  // REQUIRED

    // -------------------------------
    // BASIC FILTERS
    // -------------------------------
    if (req.query.type) q.type = req.query.type;           // leave / outpass
    if (req.query.status) q.status = req.query.status;     // pending/approved/...
    if (req.query.location_status)
      q.location_status = req.query.location_status;       // inside/outside

    // -------------------------------
    // TEXT SEARCH
    // -------------------------------
    if (req.query.search) {
      const regex = new RegExp(req.query.search, "i");
      q.$or = [
        { request_reason: regex },
        { place_to_visit: regex },
        { address_details: regex }
      ];
    }

    // -------------------------------
    // DATE RANGE FILTERS
    // -------------------------------
    if (req.query.from_date_start || req.query.from_date_end) {
      q.from_date = {};
      if (req.query.from_date_start) q.from_date.$gte = new Date(req.query.from_date_start);
      if (req.query.from_date_end) q.from_date.$lte = new Date(req.query.from_date_end);
    }

    if (req.query.to_date_start || req.query.to_date_end) {
      q.to_date = {};
      if (req.query.to_date_start) q.to_date.$gte = new Date(req.query.to_date_start);
      if (req.query.to_date_end) q.to_date.$lte = new Date(req.query.to_date_end);
    }

    // created_at range
    if (req.query.created_start || req.query.created_end) {
      q.created_at = {};
      if (req.query.created_start) q.created_at.$gte = new Date(req.query.created_start);
      if (req.query.created_end) q.created_at.$lte = new Date(req.query.created_end);
    }

    // -------------------------------
    // PAGINATION
    // -------------------------------
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const list = await LeaveOutpass.find(q)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .select(hiddenProjection());

    const total = await LeaveOutpass.countDocuments(q);

    return res.json({
      success: true,
      page,
      limit,
      total,
      count: list.length,
      data: list
    });

  } catch (err) {
    console.error("Leave/List Error →", err);
    res.status(500).json({ issue: "server_error" });
  }
});


/* ============================================================
   3. GET ONE REQUEST (STUDENT)
   ============================================================ */
router.get("/:request_id", async (req, res) => {
  try {
    const userId = req.user?.auth_user_id;

    const doc = await LeaveOutpass.findOne({
      request_id: req.params.request_id,
      auth_user_id: userId
    }).select(hiddenProjection());

    if (!doc) {
      return res.status(404).json({ issue: "not_found", message: "Request not found" });
    }

    return res.json({ success: true, data: doc });

  } catch (err) {
    console.error("Leave/GetOne Error →", err);
    res.status(500).json({ issue: "server_error" });
  }
});

/* ============================================================
   4. UPDATE (PUT) — ONLY WHEN PENDING
   ============================================================ */
router.put("/:request_id", async (req, res) => {
  try {
    const userId = req.user?.auth_user_id;

    const updateData = { ...req.body };

    // block protected fields
    protectedUpdateFields.forEach(f => delete updateData[f]);

    const doc = await LeaveOutpass.findOne({
      request_id: req.params.request_id,
      auth_user_id: userId
    });

    if (!doc) {
      return res.status(404).json({ issue: "not_found" });
    }

    if (doc.status !== "pending") {
      return res.status(403).json({
        issue: "not_editable",
        message: "Only pending requests can be edited"
      });
    }

    Object.assign(doc, updateData);
    doc.updated_at = Date.now();

    const saved = await doc.save();

    return res.json({ success: true, message: "Updated", data: saved });

  } catch (err) {
    console.error("Leave/PUT Error →", err);
    res.status(500).json({ issue: "server_error" });
  }
});

/* ============================================================
   5. PATCH (PARTIAL UPDATE) — ONLY WHEN PENDING
   ============================================================ */
router.patch("/:request_id", async (req, res) => {
  try {
    const userId = req.user?.auth_user_id;
    const updateData = { ...req.body };

    protectedUpdateFields.forEach(f => delete updateData[f]);

    const doc = await LeaveOutpass.findOne({
      request_id: req.params.request_id,
      auth_user_id: userId
    });

    if (!doc) return res.status(404).json({ issue: "not_found" });
    if (doc.status !== "pending")
      return res.status(403).json({ issue: "not_editable" });

    Object.assign(doc, updateData);
    doc.updated_at = Date.now();

    await doc.save();

    return res.json({ success: true, message: "Updated", data: doc });

  } catch (err) {
    console.error("Leave/PATCH Error →", err);
    res.status(500).json({ issue: "server_error" });
  }
});

/* ============================================================
   6. DELETE — ONLY WHEN PENDING
   ============================================================ */
router.delete("/:request_id", async (req, res) => {
  try {
    const userId = req.user?.auth_user_id;

    const doc = await LeaveOutpass.findOne({
      request_id: req.params.request_id,
      auth_user_id: userId
    });

    if (!doc) {
      return res.status(404).json({ issue: "not_found" });
    }

    if (doc.status !== "pending") {
      return res.status(403).json({
        issue: "not_deletable",
        message: "Only pending requests can be deleted"
      });
    }

    await LeaveOutpass.deleteOne({ request_id: doc.request_id });

    return res.json({ success: true, message: "Request deleted" });

  } catch (err) {
    console.error("Leave/Delete Error →", err);
    res.status(500).json({ issue: "server_error" });
  }
});

// EXPORT ROUTER
module.exports = {
    router,
    LeaveOutpass
};