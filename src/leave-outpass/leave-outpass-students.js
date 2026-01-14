// src/leave-outpass/leave-outpass.js

const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const crypto = require("crypto");

const LeaveOutpassSchemaArray = [
  // ==========================================================
  // IDENTIFIERS
  // ==========================================================
  { key: "request_id", type: "String", required: true, unique: true },
  { key: "auth_user_id", type: "String", required: true }, // student

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
  // PICKUP PERSON DETAILS (FOR GIRLS)
  // ==========================================================
  { key: "pickup_person_name", type: "String" },
  { key: "pickup_person_relation", type: "String" },   // Father / Brother / Guardian / etc
  { key: "pickup_person_phone", type: "String" },
  { key: "pickup_person_id_type", type: "String" },    // Aadhaar / DL / Passport
  { key: "pickup_person_id_number", type: "String" },

  // ==========================================================
  // DATE & TIME
  // ==========================================================
  { key: "from_date", type: "Date" },
  { key: "to_date", type: "Date" },
  { key: "return_date", type: "Date" },
  { key: "expected_in_time", type: "String" },

  // ==========================================================
  // APPROVAL FLOW (LINEAR)
  // ==========================================================
  { key: "current_level", type: "String", enum: ["mentor", "hod", "admin", "completed"], default: "mentor" },

  // Mentor
  { key: "mentor_name", type: "String" },
  { key: "mentor_email", type: "String" },
  { key: "mentor_phone", type: "String" },
  { key: "mentor_status", type: "String", enum: ["pending", "approved", "rejected"], default: "pending" },
  { key: "mentor_note", type: "String" },
  { key: "mentor_action_at", type: "Date" },

  // HOD
  { key: "hod_name", type: "String" },
  { key: "hod_email", type: "String" },
  { key: "hod_phone", type: "String" },
  { key: "hod_status", type: "String", enum: ["pending", "approved", "rejected"], default: "pending" },
  { key: "hod_note", type: "String" },
  { key: "hod_action_at", type: "Date" },

  // Admin
  { key: "admin", type: "String" },
  { key: "admin_email", type: "String" },
  { key: "admin_phone", type: "String" },
  { key: "admin_status", type: "String", enum: ["pending", "approved", "rejected"], default: "pending" },
  { key: "admin_note", type: "String" },
  { key: "admin_action_at", type: "Date" },

  // ==========================================================
  // FINAL STATUS (DERIVED)
  // ==========================================================
  {
    key: "status",
    type: "String",
    enum: ["pending", "approved", "rejected", "cancelled", "completed"],
    default: "pending"
  },

  // ==========================================================
  // LOCATION TRACKING
  // ==========================================================
  {
    key: "location_status",
    type: "String",
    enum: ["inside", "outside"],
    default: "inside"
  },
  // ==========================================================
  // LATE / NO RETURN TRACKING
  // ==========================================================
  { key: "is_gate_in_missed", type: "Boolean", default: false }, // true if not returned on time
  { key: "gate_in_missed_reason", type: "String" },              // explanation (optional)
  { key: "marked_missed_at", type: "Date" },                     // when system/admin marked it
  { key: "escalation_level", type: "String", enum: ["none", "mentor", "hod", "admin"], default: "none" },

  // ==========================================================
  // GATE LOGS
  // ==========================================================
  { key: "gate_out_time", type: "Date" },
  { key: "gate_in_time", type: "Date" },
  { key: "gate_verified_by", type: "String" },

  // ==========================================================
  // AUDIT
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
  // Request basics
  "type","request_reason","place_to_visit","address_details",
  "mode_of_transport", "from_date","to_date","return_date",
  "expected_in_time", "pickup_person_name", "pickup_person_relation",
  "pickup_person_phone","pickup_person_id_type","pickup_person_id_number"
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
    auth_user_id: 0,
    mentor_id: 0, mentor_note: 0,
    hod_id: 0, hod_note: 0,
    admin_id: 0, admin_note: 0,
    gate_verified_by: 0, qr_payload: 0, qr_signature: 0,
    action_history: 0
  };
}


const protectedUpdateFields = [
  // Core identifiers
  "auth_user_id",
  "request_id",

  // Workflow control
  "current_level",
  "status",

  // Mentor fields
  "mentor_id","mentor_status","mentor_note","mentor_action_at",
  "hod_id","hod_status","hod_note","hod_action_at",
  "admin_id","admin_status","admin_note","admin_action_at","qr_payload",
  "qr_signature","qr_generated_at","gate_out_time","gate_in_time",
  "gate_verified_by","location_status","is_gate_in_missed",
  "gate_in_missed_reason","marked_missed_at","escalation_level",
  "action_history","created_at","updated_at"
];


/* ============================================================
   CREATE LEAVE / OUTPASS REQUEST (STUDENT)
   ============================================================ */
router.post("/request", async (req, res) => {
  try {
    const userId = req.user?.auth_user_id;
    if (!userId) {
      return res.status(401).json({
        issue: "unauthorized",
        message: "Invalid token"
      });
    }

    // 1️⃣ Fetch student (single source of truth)
    const student = await Student.findOne({ auth_user_id: userId }).lean();
    if (!student) {
      return res.status(404).json({
        issue: "not_found",
        message: "Student not found"
      });
    }

    // 2️⃣ Pick only allowed public fields
    const data = sanitizeForCreate(req.body);

    // 3️⃣ Validate mandatory request fields (NOT in student DS)
    const requiredFields = [
      "type",
      "from_date",
      "expected_in_time",
      "request_reason",
      "place_to_visit",
      "address_details",
      "mode_of_transport"
    ];

    const missing = requiredFields.filter(f => !data[f]);
    if (missing.length > 0) {
      return res.status(400).json({
        issue: "validation_error",
        message: "Missing required request fields",
        missing_fields: missing
      });
    }

    // 4️⃣ Female pickup validation (gender comes from student DS)
    if (student.gender === "female") {
      const pickupRequired = [
        "pickup_person_name",
        "pickup_person_relation",
        "pickup_person_phone"
      ];

      const pickupMissing = pickupRequired.filter(f => !data[f]);
      if (pickupMissing.length > 0) {
        return res.status(400).json({
          issue: "validation_error",
          message: "Pickup person details are mandatory for female students",
          missing_fields: pickupMissing
        });
      }
    }

    // 5️⃣ Core identifiers
    data.request_id = crypto.randomUUID();
    data.auth_user_id = userId;

    // 6️⃣ Approval flow initialization
    data.current_level = "mentor";
    data.status = "pending";

    // 7️⃣ Snapshot authorities FROM STUDENT DS
    data.mentor_name = student.mentor_name || null;
    data.mentor_email = student.mentor_email || null;
    data.mentor_phone = student.mentor_phone || null;
    data.mentor_status = "pending";

    data.hod_name = student.hod_name || null;
    data.hod_email = student.hod_email || null;
    data.hod_phone = student.hod_phone || null;
    data.hod_status = "pending";

    data.admin = "admin";
    data.admin_email = process.env.ADMIN_EMAIL || null;
    data.admin_phone = process.env.ADMIN_PHONE || null;
    data.admin_status = "pending";

    // 8️⃣ Snapshot emergency contacts FROM STUDENT DS
    data.parent_phone =
      student.father_phone || student.mother_phone || null;

    data.guardian_phone = student.guardian_phone || null;

    data.class_coordinator_name = student.class_coordinator_name || null;
    data.class_coordinator_email = student.class_coordinator_email || null;
    data.class_coordinator_phone = student.class_coordinator_phone || null;

    data.warden_email = student.assigned_warden_email || null;
    data.warden_phone = student.assigned_warden_phone || null;

    // 9️⃣ Tracking defaults
    data.location_status = "inside";
    data.is_gate_in_missed = false;
    data.escalation_level = "none";

    // 🔟 Metadata
    data.created_at = Date.now();
    data.updated_at = Date.now();

    // 1️⃣1️⃣ Create document
    const doc = await LeaveOutpass.create(data);

    return res.json({
      success: true,
      message: "Leave / Outpass request submitted successfully",
      data: doc
    });

  } catch (err) {
    console.error("Leave/Create Error →", err);
    return res.status(500).json({
      issue: "server_error",
      message: "Something went wrong"
    });
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