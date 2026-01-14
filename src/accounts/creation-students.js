// src/accounts/creation-students.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const StudentSchemaArray = [

  // ================= AUTH =================
  { key: "auth_user_id", type: "String", required: true, unique: true },
  { key: "email", type: "String", required: true, unique: true, lowercase: true, index: true },

  {
    key: "emails",
    type: "Array",
    default: [],
    schema: [
      { key: "email", type: "String", required: true },
      { key: "is_primary", type: "Boolean", default: false },
      { key: "verified", type: "Boolean", default: false },
      { key: "added_at", type: "Date", default: "Date.now" }
    ]
  },

  { key: "password", type: "String", required: true },
  { key: "role", type: "String", enum: ["student"], default: "student" },

  { key: "email_verified", type: "Boolean", default: true },
  { key: "verification_code", type: "String" },
  { key: "verification_expiry", type: "Date" },
  { key: "reset_token", type: "String" },
  { key: "reset_token_expiry", type: "Date" },

  { key: "refresh_tokens", type: "Array", default: [] },

  { key: "is_blocked", type: "Boolean", default: false,index: true  },
  { key: "block_reason", type: "String" },
  { key: "failed_attempts", type: "Number", default: 0 },
  { key: "last_failed_attempt", type: "Date" },
  { key: "last_login", type: "Date" },
  { key: "last_ip", type: "String" },

  // ================= BASIC PROFILE =================
  { key: "name", type: "String", required: true },
  { key: "roll_number", type: "String", unique: true, index: true  },
  { key: "register_number", type: "String", unique: true , index: true },
  { key: "department", type: "String", index: true  },
  { key: "year", type: "String", index: true  },
  { key: "section", type: "String", index: true  },
  { key: "batch", type: "String", index: true  },
  { key: "profile_image_key", type: "String" },

    // ================= PERSONAL =================
  { key: "gender", type: "String" },
  { key: "dob", type: "Date" },
  { key: "blood_group", type: "String" },
  { key: "nationality", type: "String" },
  { key: "religion", type: "String" },
  { key: "community", type: "String" },

  // ================= ACADEMIC SNAPSHOT =================
  { key: "internal_marks", type: "Number" },
  { key: "external_marks", type: "Number" },
  { key: "total_marks", type: "Number" },
  { key: "percentage", type: "Number" },
  { key: "attendance_percentage", type: "Number" },
  { key: "grade", type: "String" },
  { key: "gpa", type: "Number" },
  { key: "cgpa", type: "Number" },
  { key: "result_status", type: "String" },
  { key: "academic_status", type: "String" },

  // ================= ADMISSION (FLATTENED) =================
  { key: "admission_type", type: "String", enum: ["regular", "management", "lateral"], default: "regular" },
  { key: "quota_category", type: "String", enum: ["general", "obc", "sc", "st", "ews", "minority"] },
  { key: "quota_sub_category", type: "String" },
  { key: "admission_year", type: "String" },

  // ================= HOSTEL (CURRENT STATE) =================
  { key: "hostel_block", type: "String" },
  { key: "room_number", type: "String" },
  { key: "bed_number", type: "String" },
  { key: "floor", type: "Number" },
  { key: "warden_name", type: "String" },
  { key: "food_type", type: "String" }, // fixed key name

  // ================= SCHOLARSHIPS =================
  {
    key: "scholarships",
    type: "Array",
    default: [],
    schema: [
      { key: "name", type: "String" },
      { key: "category", type: "String", enum: ["merit", "need", "sports", "govt", "private"] },
      { key: "amount", type: "Number" },
      { key: "academic_year", type: "String" },
      { key: "status", type: "String", enum: ["applied", "approved", "rejected", "credited"] },
      { key: "credited_date", type: "Date" }
    ]
  },

  // ================= REMARKS =================
  { key: "behavior_rating", type: "Number" },
  { key: "discipline_rating", type: "Number" },
  { key: "attitude", type: "String" },
  { key: "faculty_remark", type: "String" },
  { key: "trust_level", type: "String" },

  // ================= AUTHORITIES (LINEAR) =================
  { key: "mentor_id", type: "String" },
  { key: "mentor_name", type: "String" },
  { key: "mentor_email", type: "String" },
  { key: "mentor_phone", type: "String" },

  { key: "class_coordinator_id", type: "String" },
  { key: "class_coordinator_name", type: "String" },
  { key: "class_coordinator_email", type: "String" },
  { key: "class_coordinator_phone", type: "String" },

  { key: "hod_id", type: "String" },
  { key: "hod_name", type: "String" },
  { key: "hod_email", type: "String" },
  { key: "hod_phone", type: "String" },

  { key: "assigned_warden_id", type: "String" },
  { key: "assigned_warden_phone", type: "String" },
  { key: "assigned_warden_email", type: "String" },

  { key: "emergency_contact_priority", type: "String", enum: ["mentor", "coordinator", "hod", "warden"], default: "mentor" },

  // ================= CONTACT =================
  { key: "phone", type: "String" },
  { key: "alternate_phone", type: "String" },
  { key: "whatsapp_number", type: "String" },

  { key: "father_name", type: "String" },
  { key: "father_phone", type: "String" },
  { key: "father_email", type: "String" },

  { key: "mother_name", type: "String" },
  { key: "mother_phone", type: "String" },
  { key: "mother_email", type: "String" },

  { key: "guardian_name", type: "String" },
  { key: "guardian_phone", type: "String" },
  { key: "guardian_email", type: "String" },

  // ================= ADDRESS & SCHOOL =================
  { key: "address_line_1", type: "String" },
  { key: "address_line_2", type: "String" },
  { key: "city", type: "String" },
  { key: "state", type: "String" },
  { key: "pincode", type: "String" },
  { key: "permanent_address", type: "String" },

  { key: "school_name", type: "String" },
  { key: "school_board", type: "String" },
  { key: "school_percentage", type: "Number" },

  // ================= META =================
  { key: "status", type: "String", enum: ["in", "waiting", "out"], default: "in" },
  { key: "created_at", type: "Date", default: "Date.now" },
  { key: "updated_at", type: "Date", default: "Date.now" }
];



// 2. TYPE MAP + BUILD SCHEMA OBJECT
const typeMap = { String: String, Number: Number, Date: Date, Array: Array, Boolean: Boolean };
const schemaObject = {};

StudentSchemaArray.forEach(f => {
  let field = {};

  // ----- ARRAY FIELDS -----
  if (f.type === "Array") {
    if (f.schema) {
      // Array of sub-documents
      field.type = [
        f.schema.reduce((acc, sf) => {
          acc[sf.key] = {
            type: typeMap[sf.type],
            ...(sf.enum && { enum: sf.enum }),
            ...(sf.default && {
              default: sf.default === "Date.now" ? Date.now : sf.default
            }),
            ...(sf.required && { required: true })
          };
          return acc;
        }, {})
      ];
    } else {
      field.type = [mongoose.Schema.Types.Mixed];
    }
    field.default = f.default ?? [];
  }

  // ----- PRIMITIVE FIELDS -----
  else {
    field.type = typeMap[f.type];
  }

  if (f.required) field.required = true;
  if (f.unique) field.unique = true;
  if (f.lowercase) field.lowercase = true;
  if (f.index) field.index = true;
  if (f.enum) field.enum = f.enum;

  if (f.default && f.type !== "Array") {
    field.default = f.default === "Date.now" ? Date.now : f.default;
  }

  schemaObject[f.key] = field;
});


// 3. CREATE SCHEMA & MODEL
const StudentSchema = new mongoose.Schema(schemaObject, {
  versionKey: false,
  timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
});

const Student = mongoose.model("Student", StudentSchema);


const allowedPublicFields = [
  "name","email",
  "roll_number","register_number","department","year","section","batch",
  "profile_image_key",
  "internal_marks","external_marks","total_marks","percentage",
  "attendance_percentage","grade","gpa","cgpa","result_status","academic_status",
  "hostel_block","room_number","bed_number","floor","warden_name","food_type",
  "behavior_rating","discipline_rating","attitude","faculty_remark","trust_level",
  "mentor_id","mentor_name","mentor_email","mentor_phone",
  "class_coordinator_id","class_coordinator_name","class_coordinator_email","class_coordinator_phone",
  "hod_id","hod_name","hod_email","hod_phone",
  "assigned_warden_id","assigned_warden_phone","assigned_warden_email",
  "gender","dob","blood_group","nationality","religion","community",
  "phone","alternate_phone","whatsapp_number",
  "father_name","father_phone","father_email",
  "mother_name","mother_phone","mother_email",
  "guardian_name","guardian_phone","guardian_email",
  "address_line_1","address_line_2","city","state","pincode","permanent_address",
  "school_name","school_board","school_percentage",
  "emails",
  "scholarships",
  "emergency_contact_priority",
  "status"
];

function sanitizeForCreate(obj = {}) {
  const out = {};
  Object.keys(obj).forEach(k => {
    if (allowedPublicFields.includes(k)) {
      out[k] = obj[k];
    }
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
    verification_expiry: 0,
    failed_attempts: 0,
    block_reason: 0
  };
}


const protectedUpdateFields = [
  "auth_user_id",
  "role",
  "email_verified",

  "verification_code",
  "verification_expiry",
  "reset_token",
  "reset_token_expiry",
  "refresh_tokens",

  "is_blocked",
  "block_reason",
  "failed_attempts",
  "last_failed_attempt",
  "last_login",
  "last_ip",

  "created_at",
  "updated_at"
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
    // 👇 MANUALLY PICK PASSWORD (before hashing)
    const rawPassword = incoming.password || "Student@123";
    data.password = await bcrypt.hash(rawPassword, 10);
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
// 2. GET ALL STUDENTS (FILTERS + SEARCH + PAGINATION)
// ======================================================================
router.get("/", async (req, res) => {
  try {
    const q = {};

    // ------------------------------------------------
    // BASIC FILTERS
    // ------------------------------------------------
    if (req.query.department) q.department = req.query.department;
    if (req.query.year) q.year = req.query.year;
    if (req.query.section) q.section = req.query.section;
    if (req.query.batch) q.batch = req.query.batch;
    if (req.query.hostel_block) q.hostel_block = req.query.hostel_block;
    if (req.query.status) q.status = req.query.status;

    // ------------------------------------------------
    // ADVANCED FILTERS
    // ------------------------------------------------
    if (req.query.gender) q.gender = req.query.gender;
    if (req.query.city) q.city = req.query.city;
    if (req.query.state) q.state = req.query.state;

    if (req.query.room_number) q.room_number = req.query.room_number;
    if (req.query.floor !== undefined) {
      const floor = Number(req.query.floor);
      if (!Number.isNaN(floor)) q.floor = floor;
    }

    // ------------------------------------------------
    // DATE RANGE FILTER (created_at)
    // ------------------------------------------------
    if (req.query.created_start || req.query.created_end) {
      q.created_at = {};
      if (req.query.created_start) {
        q.created_at.$gte = new Date(req.query.created_start);
      }
      if (req.query.created_end) {
        q.created_at.$lte = new Date(req.query.created_end);
      }
    }

    // ------------------------------------------------
    // TEXT SEARCH (SAFE)
    // ------------------------------------------------
    if (req.query.search && req.query.search.trim() !== "") {
      const regex = new RegExp(req.query.search.trim(), "i");

      q.$or = [
        { name: regex },
        { roll_number: regex },
        { register_number: regex },
        { phone: regex },
        { father_name: regex },
        { mother_name: regex }
      ];
    }

    // ------------------------------------------------
    // PAGINATION
    // ------------------------------------------------
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    // ------------------------------------------------
    // SORTING (WHITELISTED)
    // ------------------------------------------------
    const allowedSortFields = [
      "created_at",
      "name",
      "roll_number",
      "department",
      "year",
      "cgpa",
      "attendance_percentage"
    ];

    const sortBy = allowedSortFields.includes(req.query.sort_by)
      ? req.query.sort_by
      : "created_at";

    const sortOrder = req.query.sort_order === "asc" ? 1 : -1;

    // ------------------------------------------------
    // QUERY EXECUTION
    // ------------------------------------------------
    const [list, total] = await Promise.all([
      Student.find(q)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .select(hiddenProjection())
        .lean(),

      Student.countDocuments(q)
    ]);

    // ------------------------------------------------
    // RESPONSE
    // ------------------------------------------------
    return res.json({
      success: true,
      page,
      limit,
      total,
      count: list.length,
      sort_by: sortBy,
      sort_order: sortOrder === 1 ? "asc" : "desc",
      data: list
    });

  } catch (err) {
    console.error("Student List Error:", err);
    return res.status(500).json({
      success: false,
      issue: "server_error",
      message: "Internal server error"
    });
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

// EXPORT ROUTER// ======================================================================
// 2. GET ALL STUDENTS (FILTERS + SEARCH + PAGINATION)
// ======================================================================
router.get("/", async (req, res) => {
  try {
    const q = {};

    // ------------------------------------------------
    // BASIC FILTERS
    // ------------------------------------------------
    if (req.query.department) q.department = req.query.department;
    if (req.query.year) q.year = req.query.year;
    if (req.query.section) q.section = req.query.section;
    if (req.query.batch) q.batch = req.query.batch;
    if (req.query.hostel_block) q.hostel_block = req.query.hostel_block;
    if (req.query.status) q.status = req.query.status;

    // ------------------------------------------------
    // ADVANCED FILTERS
    // ------------------------------------------------
    if (req.query.gender) q.gender = req.query.gender;
    if (req.query.city) q.city = req.query.city;
    if (req.query.state) q.state = req.query.state;

    if (req.query.room_number) q.room_number = req.query.room_number;
    if (req.query.floor !== undefined) {
      const floor = Number(req.query.floor);
      if (!Number.isNaN(floor)) q.floor = floor;
    }

    // ------------------------------------------------
    // DATE RANGE FILTER (created_at)
    // ------------------------------------------------
    if (req.query.created_start || req.query.created_end) {
      q.created_at = {};
      if (req.query.created_start) {
        q.created_at.$gte = new Date(req.query.created_start);
      }
      if (req.query.created_end) {
        q.created_at.$lte = new Date(req.query.created_end);
      }
    }

    // ------------------------------------------------
    // TEXT SEARCH (SAFE)
    // ------------------------------------------------
    if (req.query.search && req.query.search.trim() !== "") {
      const regex = new RegExp(req.query.search.trim(), "i");

      q.$or = [
        { name: regex },
        { roll_number: regex },
        { register_number: regex },
        { phone: regex },
        { father_name: regex },
        { mother_name: regex }
      ];
    }

    // ------------------------------------------------
    // PAGINATION
    // ------------------------------------------------
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    // ------------------------------------------------
    // SORTING (WHITELISTED)
    // ------------------------------------------------
    const allowedSortFields = [
      "created_at",
      "name",
      "roll_number",
      "department",
      "year",
      "cgpa",
      "attendance_percentage"
    ];

    const sortBy = allowedSortFields.includes(req.query.sort_by)
      ? req.query.sort_by
      : "created_at";

    const sortOrder = req.query.sort_order === "asc" ? 1 : -1;

    // ------------------------------------------------
    // QUERY EXECUTION
    // ------------------------------------------------
    const [list, total] = await Promise.all([
      Student.find(q)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .select(hiddenProjection())
        .lean(),

      Student.countDocuments(q)
    ]);

    // ------------------------------------------------
    // RESPONSE
    // ------------------------------------------------
    return res.json({
      success: true,
      page,
      limit,
      total,
      count: list.length,
      sort_by: sortBy,
      sort_order: sortOrder === 1 ? "asc" : "desc",
      data: list
    });

  } catch (err) {
    console.error("Student List Error:", err);
    return res.status(500).json({
      success: false,
      issue: "server_error",
      message: "Internal server error"
    });
  }
});
module.exports = {
  Student,
  router
};