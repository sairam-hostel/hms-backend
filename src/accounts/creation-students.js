// src/accounts/creation-students.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

// 1. SCHEMA DESCRIPTION (including auth + profile)
const StudentSchemaArray = [
  // Auth / login fields
  { key: "auth_user_id", type: "String", required: true, unique: true },
  { key: "email", type: "String", required: true, unique: true, lowercase: true, index: true },
  { key: "password", type: "String", required: true },
  { key: "role", type: "String", enum: ["student"], default: "student" },

  // Email verification / password reset (optional)
  { key: "email_verified", type: "Boolean", default: true },
  { key: "verification_code", type: "String" },
  { key: "verification_expiry", type: "Date" },
  { key: "reset_token", type: "String" },
  { key: "reset_token_expiry", type: "Date" },

  // Session / refresh tokens store (if you want JWT + refresh support)
  { key: "refresh_tokens", type: "Array", default: [] },

  // Security / login tracking
  { key: "is_blocked", type: "Boolean", default: false },
  { key: "block_reason", type: "String" },
  { key: "failed_attempts", type: "Number", default: 0 },
  { key: "last_failed_attempt", type: "Date" },
  { key: "last_login", type: "Date" },
  { key: "last_ip", type: "String" },

  // Student-specific profile fields
  { key: "name", type: "String", required: true },
  { key: "roll_number", type: "String", unique: true },
  { key: "register_number", type: "String", unique: true },
  { key: "department", type: "String" },
  { key: "year", type: "String" },
  { key: "section", type: "String" },
  { key: "batch", type: "String" },
  { key: "profile_image_key", type: "String" },

  //Academic snapshot fields
  { key: "internal_marks", type: "Number" },        // CIA / Mid-sem
  { key: "external_marks", type: "Number" },        // End-sem exam
  { key: "total_marks", type: "Number" },           // Internal + External
  { key: "percentage", type: "Number" },            // Overall %
  { key: "attendance_percentage", type: "Number" },  // Attendance %

  { key: "grade", type: "String" },                  // A, B+, etc
  { key: "gpa", type: "Number" },                    // Semester GPA
  { key: "cgpa", type: "Number" },                   // Cumulative GPA
  { key: "result_status", type: "String" },          // PASS / FAIL
  { key: "academic_status", type: "String" },   

  //Remark fields

  { key: "behavior_rating", type: "Number" },        // 1–5
  { key: "discipline_rating", type: "Number" },      // 1–5
  { key: "attitude", type: "String" },               // POSITIVE / NEUTRAL / NEGATIVE
  { key: "faculty_remark", type: "String" },         // Free-text
  { key: "trust_level", type: "String" },             // HIGH / MEDIUM / LOW



  // Hostel specific fields 
  { key: "hostel_block", type: "String" },
  { key: "room_number", type: "String" },
  { key: "bed_number", type: "String" },
  { key: "warden_name", type: "String" },
  { key: "floor", type: "Number" },

  // Additional fields 
  { key: "gender", type: "String" },
  { key: "dob", type: "Date" },
  { key: "blood_group", type: "String" },
  { key: "nationality", type: "String" },
  { key: "religion", type: "String" },
  { key: "community", type: "String" },

  // Contact fields
  { key: "phone", type: "String" },
  { key: "alternate_phone", type: "String" },
  { key: "whatsapp_number", type: "String" },
  { key: "father_name", type: "String" },
  { key: "father_phone", type: "String" },
  { key: "mother_name", type: "String" },
  { key: "mother_phone", type: "String" },
  { key: "guardian_name", type: "String" },
  { key: "guardian_phone", type: "String" },

  { key: "address_line_1", type: "String" },
  { key: "address_line_2", type: "String" },
  { key: "city", type: "String" },
  { key: "state", type: "String" },
  { key: "pincode", type: "String" },
  { key: "permanent_address", type: "String" },

  { key: "school_name", type: "String" },
  { key: "school_board", type: "String" },
  { key: "school_percentage", type: "Number" },

  { key: "status", type: "String", enum: ["in", "waiting", "out"], default: "in" },

  // Metadata
  { key: "created_at", type: "Date", default: "Date.now" },
  { key: "updated_at", type: "Date", default: "Date.now" }
];

// 2. TYPE MAP + BUILD SCHEMA OBJECT
const typeMap = { String: String, Number: Number, Date: Date, Array: Array, Boolean: Boolean };
const schemaObject = {};

StudentSchemaArray.forEach(f => {
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

// 3. CREATE SCHEMA & MODEL
const StudentSchema = new mongoose.Schema(schemaObject, { versionKey: false });

StudentSchema.pre("save", async function () {
  this.updated_at = Date.now();
});

const Student = mongoose.model("Student", StudentSchema);

// 4. HELPERS
const allowedPublicFields = [
  "name", "email", "password", "role",
  "roll_number", "register_number", "department", "year", "section", "batch", "profile_img",
  "hostel_block", "room_number", "bed_number", "warden_name", "floor",
  "gender", "dob", "blood_group", "nationality", "religion", "community",
  "phone", "alternate_phone", "whatsapp_number",
  "father_name", "father_phone", "mother_name", "mother_phone",
  "guardian_name", "guardian_phone",
  "address_line_1", "address_line_2", "city", "state", "pincode", "permanent_address",
  "school_name", "school_board", "school_percentage",
  "status"
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
    password: 0,
    reset_token: 0,
    reset_token_expiry: 0,
    refresh_tokens: 0,
    verification_code: 0,
    verification_expiry: 0
  };
}

const protectedUpdateFields = [
  "auth_user_id", "email_verified", "verification_code",
  "verification_expiry", "reset_token", "reset_token_expiry",
  "refresh_tokens", "is_blocked", "failed_attempts",
  "last_failed_attempt", "last_login", "last_ip","profile_img",
  "created_at", "updated_at"  
];


// ======================================================================
// 1. CREATE STUDENT
// ======================================================================
// CREATE (register student)
router.post("/register", async (req, res) => {
  try {
    const incoming = req.body || {};
    if (!incoming.name || !incoming.email) {
      return res.status(400).json({ issue: "missing_fields", message: "name and email required" });
    }
// ---- UNIQUE FIELD CHECKS ----
    // 1. Email
    const existingEmail = await Student.findOne({ email: incoming.email.toLowerCase() });
    if (existingEmail) {
      return res.status(409).json({
        issue: "email_exists",
        message: "Email already in use"
      });
    }

    // 2. Roll number
    if (incoming.roll_number) {
      const existingRoll = await Student.findOne({ roll_number: incoming.roll_number });
      if (existingRoll) {
        return res.status(409).json({
          issue: "roll_number_exists",
          message: "Roll number already in use"
        });
      }
    }

    // 3. Register number
    if (incoming.register_number) {
      const existingRegNum = await Student.findOne({ register_number: incoming.register_number });
      if (existingRegNum) {
        return res.status(409).json({
          issue: "register_number_exists",
          message: "Register number already in use"
        });
      }
    }

    const data = sanitizeForCreate(incoming);
    data.role = "student";
    const rawPassword = data.password || "Student@123";
    data.password = await bcrypt.hash(rawPassword, 10);
    data.auth_user_id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");
    data.created_at = Date.now();
    data.updated_at = Date.now();

    const student = await Student.create(data);
    return res.json({
      success: true,
      message: "Student registered",
      data: { id: student._id, auth_user_id: student.auth_user_id, email: student.email, name: student.name }
    });

  } catch (err) {
    console.error("Student Register Error:", err);
    return res.status(500).json({ issue: "server_error", message: "Internal server error" });
  }
});

// ======================================================================
// 2. GET ALL STUDENTS (WITH FILTERS + SEARCH + PAGINATION)
// ======================================================================
router.get("/", async (req, res) => {
  try {
    const q = {};

    // -------------------------------
    // BASIC FIELD FILTERS
    // -------------------------------
    if (req.query.department) q.department = req.query.department;
    if (req.query.year) q.year = req.query.year;
    if (req.query.section) q.section = req.query.section;
    if (req.query.batch) q.batch = req.query.batch;
    if (req.query.hostel_block) q.hostel_block = req.query.hostel_block;
    if (req.query.status) q.status = req.query.status;  // in / waiting / out

    // -------------------------------
    // ADVANCED FILTERS
    // -------------------------------
    if (req.query.gender) q.gender = req.query.gender;
    if (req.query.city) q.city = req.query.city;
    if (req.query.state) q.state = req.query.state;

    if (req.query.room_number) q.room_number = req.query.room_number;
    if (req.query.floor) q.floor = Number(req.query.floor);

    // -------------------------------
    // TEXT SEARCH
    // -------------------------------
    if (req.query.search) {
      const regex = new RegExp(req.query.search, "i");

      q.$or = [
        { name: regex },
        { roll_number: regex },
        { register_number: regex },
        { phone: regex },
        { father_name: regex },
        { mother_name: regex }
      ];
    }

    // -------------------------------
    // DATE RANGE FILTERS (created_at)
    // -------------------------------
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

    // -------------------------------
    // SORTING
    // -------------------------------
    const sortField = req.query.sort_by || "created_at";
    const sortOrder = req.query.sort_order === "asc" ? 1 : -1;

    const list = await Student.find(q)
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(limit)
      .select(hiddenProjection());

    const total = await Student.countDocuments(q);

    return res.json({
      success: true,
      page,
      limit,
      total,
      count: list.length,
      filters_used: q,
      data: list,
    });

  } catch (err) {
    console.error("Student List Error:", err);
    return res.status(500).json({ issue: "server_error", message: "Internal server error" });
  }
});



// ======================================================================
// 3. GET STUDENT BY ID
// ======================================================================
router.get("/:auth_user_id", async (req, res) => {
  try {
    const stu = await Student.findOne({ auth_user_id: req.params.auth_user_id })
                             .select(hiddenProjection());
    if (!stu) {
      return res.status(404).json({ issue: "not_found", message: "Student not found" });
    }
    return res.json({ success: true, data: stu });
  } catch (err) {
    console.error("Student Fetch Error:", err);
    return res.status(500).json({ issue: "server_error", message: "Internal server error" });
  }
});


// ======================================================================
// 4. UPDATE STUDENT
// ======================================================================
router.put("/:auth_user_id", async (req, res) => {
  try {
    const incoming = req.body || {};
    protectedUpdateFields.forEach(f => delete incoming[f]);
    if (incoming.password) {
      incoming.password = await bcrypt.hash(incoming.password, 10);
    }
    incoming.updated_at = Date.now();

    const updated = await Student.findOneAndUpdate(
      { auth_user_id: req.params.auth_user_id },
      incoming,
      { new: true, runValidators: true }
    ).select(hiddenProjection());

    if (!updated) {
      return res.status(404).json({ issue: "not_found", message: "Student not found" });
    }
    return res.json({ success: true, message: "Student updated", data: updated });

  } catch (err) {
    console.error("Student Update Error:", err);
    return res.status(500).json({ issue: "server_error", message: "Internal server error" });
  }
});

// ======================================================================
// 5. PATCH STUDENT
// ======================================================================

// PATCH (partial update) by auth_user_id
router.patch("/:auth_user_id", async (req, res) => {
  try {
    const updates = req.body || {};
    protectedUpdateFields.forEach(f => delete updates[f]);
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
    }
    updates.updated_at = Date.now();

    const updated = await Student.findOneAndUpdate(
      { auth_user_id: req.params.auth_user_id },
      { $set: updates },
      { new: true, runValidators: true }
    ).select(hiddenProjection());

    if (!updated) {
      return res.status(404).json({ issue: "not_found", message: "Student not found" });
    }
    return res.json({ success: true, message: "Student updated", data: updated });

  } catch (err) {
    console.error("Student PATCH Error:", err);
    return res.status(500).json({ issue: "server_error", message: "Internal server error" });
  }
});


// ======================================================================
// 6. DELETE STUDENT
// ======================================================================
// DELETE by auth_user_id
router.delete("/:auth_user_id", async (req, res) => {
  try {
    const deleted = await Student.findOneAndDelete({ auth_user_id: req.params.auth_user_id });
    if (!deleted) {
      return res.status(404).json({ issue: "not_found", message: "Student not found" });
    }
    return res.json({ success: true, message: "Student deleted successfully" });
  } catch (err) {
    console.error("Student Delete Error:", err);
    return res.status(500).json({ issue: "server_error", message: "Internal server error" });
  }
});

// EXPORT ROUTER
module.exports = {
  Student,
  router
};