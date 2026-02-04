import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const router = express.Router();

// ===============================================================
// EXTENDED FACULTY SCHEMA (SNAKE_CASE, 26 FIELDS)
// ===============================================================
const FacultySchemaArray = [
  // ==========================================================
  // INTERNAL + AUTH IDENTIFIERS
  // ==========================================================
  { key: "auth_user_id", type: "String", required: true, unique: true },   // generated internally
  { key: "email", type: "String", required: true, unique: true, lowercase: true, index: true },
  { key: "password", type: "String", required: true },
  { key: "role", type: "String", enum: ["faculty", "warden", "admin"], default: "faculty" },

  // ==========================================================
  // EMAIL VERIFICATION & PASSWORD RESET
  // ==========================================================
  { key: "email_verified", type: "Boolean", default: false },
  { key: "verification_code", type: "String" },
  { key: "verification_expiry", type: "Date" },
  { key: "reset_token", type: "String" },
  { key: "reset_token_expiry", type: "Date" },

  // ==========================================================
  // DEVICE SESSIONS (REFRESH TOKENS)
  // ==========================================================
  { key: "refresh_tokens", type: "Array", default: [] },

  // ==========================================================
  // SECURITY / LOGIN TRACKING
  // ==========================================================
  { key: "is_blocked", type: "Boolean", default: false },
  { key: "block_reason", type: "String" },
  { key: "failed_attempts", type: "Number", default: 0 },
  { key: "last_failed_attempt", type: "Date" },
  { key: "last_login", type: "Date" },
  { key: "last_ip", type: "String" },

  // ==========================================================
  // BASIC DETAILS
  // ==========================================================
  { key: "name", type: "String", required: true },
  { key: "gender", type: "String" },
  { key: "dob", type: "Date" },
  { key: "blood_group", type: "String" },
  { key: "marital_status", type: "String" },
  { key: "profile_image_key", type: "String" },


  // ==========================================================
  // CONTACT DETAILS
  // ==========================================================
  { key: "phone", type: "String" },
  { key: "alternate_phone", type: "String" },

  // ==========================================================
  // ADDRESS
  // ==========================================================
  { key: "address_line_1", type: "String" },
  { key: "address_line_2", type: "String" },
  { key: "city", type: "String" },
  { key: "state", type: "String" },
  { key: "pincode", type: "String" },

  // ==========================================================
  // WORK & FACULTY DETAILS
  // ==========================================================
  { key: "department", type: "String" },
  { key: "designation", type: "String" },
  { key: "qualification", type: "String" },
  { key: "experience_years", type: "Number" },
  { key: "joining_date", type: "Date" },

  // ==========================================================
  // HOSTEL DUTIES
  // ==========================================================
  { key: "hostel_block", type: "String" },
  { key: "assigned_floors", type: "Array" },

  // ==========================================================
  // EMERGENCY CONTACT
  // ==========================================================
  { key: "emergency_contact_name", type: "String" },
  { key: "emergency_contact_number", type: "String" },
  { key: "relation", type: "String" },

  // ==========================================================
  // METADATA
  // ==========================================================
  { key: "created_at", type: "Date", default: "Date.now" },
  { key: "updated_at", type: "Date", default: "Date.now" }
];

// ===============================================================
// STEP 2: TYPE MAP
// ===============================================================
const typeMap = {
  String: String,
  Number: Number,
  Date: Date,
  Array: Array,
  Boolean: Boolean
};

// ===============================================================
// STEP 3: CONVERT ARRAY → SCHEMA OBJECT
// ===============================================================
const schemaObject = {};
FacultySchemaArray.forEach(f => {
  const field = { type: typeMap[f.type] };

  if (f.required) field.required = true;
  if (f.unique) field.unique = true;
  if (f.lowercase) field.lowercase = true;
  if (f.index) field.index = true;
  if (f.enum) field.enum = f.enum;

  if (f.default) {
    field.default = f.default === "Date.now" ? Date.now : f.default;
  }

  schemaObject[f.key] = field;
});

// ===============================================================
// STEP 4: CREATE MONGOOSE MODEL
// ===============================================================
const FacultySchema = new mongoose.Schema(schemaObject, { versionKey: false });

FacultySchema.pre("save", async function () {
  this.updated_at = Date.now();
});

const Faculty = mongoose.model("Faculty", FacultySchema);

// ===============================================================
// STEP 5: HELPERS
// ===============================================================
const allowedPublicFields = [
  "name", "email", "password", "role",
  "gender", "dob", "blood_group", "marital_status",
  "phone", "alternate_phone",
  "address_line_1", "address_line_2", "city", "state", "pincode",
  "department", "designation", "qualification", "experience_years",
  "joining_date", "hostel_block", "assigned_floors",
  "emergency_contact_name", "emergency_contact_number", "relation"
];

function sanitizeForCreate(obj) {
  const out = {};
  for (const k in obj) {
    if (allowedPublicFields.includes(k)) out[k] = obj[k];
  }
  return out;
}

function generate6Digit() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function hiddenProjection() {
  return {
    password: 0,
    reset_token: 0,
    reset_token_expiry: 0,
    refresh_tokens: 0,
    verification_code: 0,
    verification_expiry: 0,
  };
}

const protectedUpdateFields = [
  "auth_user_id", "email_verified", "verification_code",
  "verification_expiry", "reset_token", "reset_token_expiry",
  "refresh_tokens", "is_blocked", "failed_attempts",
  "last_failed_attempt", "last_login", "last_ip",
  "created_at", "updated_at"
];



// ======================================================================
// 1. CREATE FACULTY (REGISTER)
// Required: name, email. role optional (defaults to faculty). password optional -> default 'sairam@123'
// ======================================================================
router.post("/register", async (req, res) => {
  try {
    const incoming = req.body || {};

    // ==========================================================
    // 1️⃣ BASIC REQUIRED CHECKS
    // ==========================================================
    if (!incoming.name || !incoming.email) {
      return res.status(400).json({
        issue: "missing_fields",
        message: "name and email are required."
      });
    }

    // ==========================================================
    // 2️⃣ ROLE VALIDATION (DEFAULT = faculty)
    // ==========================================================
    const role = incoming.role || "faculty";
    if (!["faculty", "warden", "admin"].includes(role)) {
      return res.status(400).json({
        issue: "invalid_role",
        message: "Invalid role provided."
      });
    }

    // ==========================================================
    // 3️⃣ EMAIL UNIQUENESS CHECK
    // ==========================================================
    const email = incoming.email.toLowerCase();
    const exists = await Faculty.findOne({ email });
    if (exists) {
      return res.status(409).json({
        issue: "email_exists",
        message: "A faculty member with this email already exists."
      });
    }

    // ==========================================================
    // 4️⃣ SANITIZE INPUT (CRITICAL)
    // ==========================================================
    // Must strip internal/system-controlled fields
    const data = sanitizeForCreate(incoming);

    // ==========================================================
    // 5️⃣ SET AUTH + ROLE FIELDS
    // ==========================================================
    data.role = role;
    data.email = email;

    // Password (default if missing)
    const rawPassword = data.password || "sairam@123";
    data.password = await bcrypt.hash(rawPassword, 10);

    // ==========================================================
    // 6️⃣ INTERNAL IDENTIFIERS & SECURITY DEFAULTS
    // ==========================================================
    data.auth_user_id =
      crypto.randomUUID?.() ||
      crypto.randomBytes(16).toString("hex");

    data.email_verified = true; // since created by admin
    data.is_blocked = false;
    data.failed_attempts = 0;
    data.refresh_tokens = [];

    // Email verification metadata (kept for consistency)
    data.verification_code = generate6Digit();
    data.verification_expiry = new Date(Date.now() + 10 * 60 * 1000);

    // ==========================================================
    // 7️⃣ METADATA
    // ==========================================================
    data.created_at = new Date();
    data.updated_at = new Date();

    // ==========================================================
    // 8️⃣ CREATE FACULTY
    // ==========================================================
    const faculty = await Faculty.create(data);

    return res.json({
      success: true,
      message: "Faculty registered successfully.",
      data: {
        id: faculty._id,
        auth_user_id: faculty.auth_user_id,
        name: faculty.name,
        email: faculty.email,
        role: faculty.role,
        email_verified: faculty.email_verified,
        created_at: faculty.created_at
      }
    });

  } catch (err) {
    console.error("Faculty Register Error:", err);
    return res.status(500).json({
      issue: "server_error",
      message: "Internal server error."
    });
  }
});


// ======================================================================
// BULK CREATE FACULTY
// Body: [ { name, email, role?, password? }, ... ]
// ======================================================================
router.post("/register/bulk", async (req, res) => {
  try {
    const payload = req.body;

    // ==========================================================
    // 1️⃣ VALIDATE ARRAY INPUT
    // ==========================================================
    if (!Array.isArray(payload) || payload.length === 0) {
      return res.status(400).json({
        issue: "invalid_payload",
        message: "Request body must be a non-empty array."
      });
    }

    const results = [];
    const docsToInsert = [];
    const now = new Date();

    // ==========================================================
    // 2️⃣ PREFETCH EXISTING EMAILS (PERFORMANCE)
    // ==========================================================
    const emails = payload
      .map(u => u?.email?.toLowerCase())
      .filter(Boolean);

    const existing = await Faculty.find(
      { email: { $in: emails } },
      { email: 1 }
    );

    const existingEmails = new Set(existing.map(e => e.email));

    // ==========================================================
    // 3️⃣ PROCESS EACH RECORD
    // ==========================================================
    for (let i = 0; i < payload.length; i++) {
      const incoming = payload[i] || {};

      // ---- required fields
      if (!incoming.name || !incoming.email) {
        results.push({
          index: i,
          status: "failed",
          issue: "missing_fields",
          message: "name and email are required."
        });
        continue;
      }

      const email = incoming.email.toLowerCase();

      // ---- duplicate email
      if (existingEmails.has(email)) {
        results.push({
          index: i,
          status: "skipped",
          issue: "email_exists",
          email
        });
        continue;
      }

      // ---- role validation
      const role = incoming.role || "faculty";
      if (!["faculty", "warden", "admin"].includes(role)) {
        results.push({
          index: i,
          status: "failed",
          issue: "invalid_role",
          email
        });
        continue;
      }

      // ======================================================
      // SANITIZE + BUILD DOCUMENT
      // ======================================================
      const data = sanitizeForCreate(incoming);

      const rawPassword = data.password || "sairam@123";
      data.password = await bcrypt.hash(rawPassword, 10);

      data.name = data.name;
      data.email = email;
      data.role = role;

      data.auth_user_id =
        crypto.randomUUID?.() ||
        crypto.randomBytes(16).toString("hex");

      data.email_verified = true;
      data.is_blocked = false;
      data.failed_attempts = 0;
      data.refresh_tokens = [];

      data.verification_code = generate6Digit();
      data.verification_expiry = new Date(Date.now() + 10 * 60 * 1000);

      data.created_at = now;
      data.updated_at = now;

      docsToInsert.push(data);
      existingEmails.add(email);

      results.push({
        index: i,
        status: "queued",
        email
      });
    }

    // ==========================================================
    // 4️⃣ BULK INSERT
    // ==========================================================
    if (docsToInsert.length > 0) {
      await Faculty.insertMany(docsToInsert, { ordered: false });
    }

    // ==========================================================
    // 5️⃣ RESPONSE
    // ==========================================================
    return res.json({
      success: true,
      total_received: payload.length,
      inserted: docsToInsert.length,
      results
    });

  } catch (err) {
    console.error("Bulk Faculty Register Error:", err);
    return res.status(500).json({
      issue: "server_error",
      message: "Internal server error."
    });
  }
});



// ======================================================================
// 2. GET ALL (with simple filtering support)
// ======================================================================
router.get("/", async (req, res) => {
  try {
    const q = {};
    // Support basic filters from querystring (only safe fields)
    const allowedFilters = ["role", "email", "department", "city", "hostel_block", "name"];
    allowedFilters.forEach(k => {
      if (req.query[k]) {
        // partial name searches for name
        if (k === "name") q[k] = { $regex: req.query[k], $options: "i" };
        else q[k] = req.query[k];
      }
    });

    // Experience range support
    if (req.query.min_exp || req.query.max_exp) {
      q.experience_years = {};
      if (req.query.min_exp) q.experience_years.$gte = Number(req.query.min_exp);
      if (req.query.max_exp) q.experience_years.$lte = Number(req.query.max_exp);
    }

    const list = await Faculty.find(q).select(hiddenProjection());
    return res.json({ success: true, count: list.length, data: list });

  } catch (err) {
    console.error("Faculty List Error:", err);
    return res.status(500).json({ issue: "server_error", message: "Internal server error." });
  }
});

// ======================================================================
// 3. GET ONE
// ======================================================================
router.get("/:auth_user_id", async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ auth_user_id: req.params.auth_user_id }).select(hiddenProjection());
    if (!faculty) {
      return res.status(404).json({ issue: "not_found", message: "Faculty not found." });
    }
    return res.json({ success: true, data: faculty });
  } catch (err) {
    console.error("Faculty Fetch Error:", err);
    return res.status(500).json({ issue: "server_error", message: "Internal server error." });
  }
});

// ======================================================================
// 4. UPDATE (PUT - replace allowed updatable fields)
// ======================================================================
router.put("/:auth_user_id", async (req, res) => {
  try {
    const incoming = req.body || {};
    protectedUpdateFields.forEach(f => delete incoming[f]);
    if (incoming.password) {
      incoming.password = await bcrypt.hash(incoming.password, 10);
    }
    incoming.updated_at = Date.now();

    const updated = await Faculty.findOneAndUpdate(
      { auth_user_id: req.params.auth_user_id },
      incoming,
      { new: true, runValidators: true }
    ).select(hiddenProjection());

    if (!updated) {
      return res.status(404).json({ issue: "not_found", message: "Faculty not found." });
    }

    return res.json({ success: true, message: "Faculty updated successfully", data: updated });

  } catch (err) {
    console.error("Faculty Update Error:", err);
    return res.status(500).json({ issue: "server_error", message: "Internal server error." });
  }
});

// ======================================================================
// 5. DELETE
// ======================================================================
// DELETE by auth_user_id
router.delete("/:auth_user_id", async (req, res) => {
  try {
    const deleted = await Faculty.findOneAndDelete({ auth_user_id: req.params.auth_user_id });
    if (!deleted) {
      return res.status(404).json({ issue: "not_found", message: "Faculty not found." });
    }
    return res.json({ success: true, message: "Faculty deleted successfully" });
  } catch (err) {
    console.error("Faculty Delete Error:", err);
    return res.status(500).json({ issue: "server_error", message: "Internal server error." });
  }
});
// ======================================================================
// 6. PATCH (PARTIAL UPDATE)
// ======================================================================
router.patch("/:auth_user_id", async (req, res) => {
  try {
    const updates = req.body || {};
    protectedUpdateFields.forEach(f => delete updates[f]);
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
    }
    updates.updated_at = Date.now();

    const updated = await Faculty.findOneAndUpdate(
      { auth_user_id: req.params.auth_user_id },
      { $set: updates },
      { new: true, runValidators: true }
    ).select(hiddenProjection());

    if (!updated) {
      return res.status(404).json({ issue: "not_found", message: "Faculty not found." });
    }

    return res.json({ success: true, message: "Faculty updated successfully", data: updated });
  } catch (err) {
    console.error("Faculty PATCH Error:", err);
    return res.status(500).json({ issue: "server_error", message: "Internal server error." });
  }
});

// ===============================================================
// STEP 7: EXPORT CORRECTLY
// ===============================================================
export default router;
export { Faculty};
