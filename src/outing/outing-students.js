import express from "express";
import mongoose from "mongoose";
import crypto from "crypto";

import { Student } from "../accounts/creation-students.js";
import { Faculty } from "../accounts/creation-faculty.js";

const router = express.Router();

// ===============================================================
// 1. OUTING SCHEMA
// ===============================================================
const OutingSchema = new mongoose.Schema(
  {
    // ===== IDENTIFIERS =====
    outing_id: { type: String, required: true, unique: true },
    auth_user_id: { type: String, required: true },

    // ===== STUDENT SNAPSHOT (denormalised for quick admin view) =====
    student_name: { type: String },
    student_roll_number: { type: String },
    student_register_number: { type: String },
    student_department: { type: String },
    student_year: { type: String },
    student_section: { type: String },
    student_room_number: { type: String },
    student_hostel_block: { type: String },
    student_phone: { type: String },
    student_gender: { type: String },

    // ===== REQUEST DETAILS =====
    // 'date' MUST be a Sunday — enforced in the POST handler
    date: { type: Date, required: true },
    reason: { type: String, required: true },

    // ===== ADMIN DECISION =====
    admin_id: { type: String },
    admin_name: { type: String },
    admin_note: { type: String },
    admin_action_at: { type: Date },

    // ===== STATUS =====
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending"
    },

    // ===== AUDIT =====
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

OutingSchema.pre("save", function () {
  this.updated_at = Date.now();
});

const Outing = mongoose.model("Outing", OutingSchema);

// ---------------------------------------------------------------
// HELPER — returns true only if the given Date is a Sunday
// ---------------------------------------------------------------
function isSunday(dateObj) {
  return dateObj.getDay() === 0;
}

// ===============================================================
// STUDENT ROUTES
// ===============================================================

/* ------------------------------------------------------------
   POST /bs1/outing
   Student applies for outing.
   Required body: { date, reason }
   - date must be a Sunday
   - Only one active (pending/approved) request per Sunday
   ------------------------------------------------------------ */
router.post("/", async (req, res) => {
  try {
    const userId = req.user?.auth_user_id;
    if (!userId) {
      return res.status(401).json({ issue: "unauthorized", message: "Invalid token" });
    }

    const { date, reason } = req.body;

    // --- Presence check ---
    if (!date || !reason) {
      return res.status(400).json({
        issue: "validation_error",
        message: "Both 'date' and 'reason' are required"
      });
    }

    // --- Date validity ---
    const outingDate = new Date(date);
    if (isNaN(outingDate.getTime())) {
      return res.status(400).json({
        issue: "validation_error",
        message: "Invalid date format. Use ISO 8601 (e.g. 2026-04-20)"
      });
    }

    // --- Sunday-only rule ---
    if (!isSunday(outingDate)) {
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      return res.status(400).json({
        issue: "not_a_sunday",
        message: `Outing is only allowed on Sundays. '${date}' falls on a ${dayNames[outingDate.getDay()]}`
      });
    }

    // --- Reason length ---
    if (typeof reason !== "string" || reason.trim().length < 5) {
      return res.status(400).json({
        issue: "validation_error",
        message: "Reason must be at least 5 characters"
      });
    }

    // --- Fetch student ---
    const student = await Student.findOne({ auth_user_id: userId }).lean();
    if (!student) {
      return res.status(404).json({ issue: "not_found", message: "Student not found" });
    }

    // --- Duplicate guard (same student, same Sunday, still active) ---
    const startOfDay = new Date(outingDate); startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(outingDate); endOfDay.setUTCHours(23, 59, 59, 999);

    const duplicate = await Outing.findOne({
      auth_user_id: userId,
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ["pending", "approved"] }
    }).lean();

    if (duplicate) {
      return res.status(409).json({
        issue: "duplicate_outing",
        message: "You already have an active outing request for this Sunday",
        existing_outing_id: duplicate.outing_id
      });
    }

    // --- Create ---
    const doc = await Outing.create({
      outing_id: crypto.randomUUID(),
      auth_user_id: userId,
      student_name: student.name || null,
      student_roll_number: student.roll_number || null,
      student_register_number: student.register_number || null,
      student_department: student.department || null,
      student_year: student.year || null,
      student_section: student.section || null,
      student_room_number: student.room_number || null,
      student_hostel_block: student.hostel_block || null,
      student_phone: student.phone || null,
      student_gender: student.gender || null,
      date: outingDate,
      reason: reason.trim(),
      status: "pending",
      created_at: Date.now(),
      updated_at: Date.now()
    });

    return res.status(201).json({
      success: true,
      message: "Outing request submitted successfully. Awaiting admin approval.",
      data: {
        outing_id: doc.outing_id,
        date: doc.date,
        reason: doc.reason,
        status: doc.status,
        created_at: doc.created_at
      }
    });

  } catch (err) {
    console.error("Outing Create Error →", err);
    return res.status(500).json({ issue: "server_error", message: "Something went wrong" });
  }
});

/* ------------------------------------------------------------
   GET /bs1/outing
   Student lists their own outing requests.
   Query: status, date_start, date_end, page, limit
   ------------------------------------------------------------ */
router.get("/", async (req, res) => {
  try {
    const userId = req.user?.auth_user_id;
    if (!userId) {
      return res.status(401).json({ issue: "unauthorized", message: "Invalid token" });
    }

    const q = { auth_user_id: userId };

    if (req.query.status) q.status = req.query.status;

    if (req.query.date_start || req.query.date_end) {
      q.date = {};
      if (req.query.date_start) q.date.$gte = new Date(req.query.date_start);
      if (req.query.date_end) q.date.$lte = new Date(req.query.date_end);
    }

    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const [list, total] = await Promise.all([
      Outing.find(q)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .select({ auth_user_id: 0, admin_id: 0 })
        .lean(),
      Outing.countDocuments(q)
    ]);

    return res.json({ success: true, page, limit, total, count: list.length, data: list });

  } catch (err) {
    console.error("Outing List Error →", err);
    return res.status(500).json({ issue: "server_error", message: "Something went wrong" });
  }
});

/* ------------------------------------------------------------
   GET /bs1/outing/:outing_id
   Student views a single request they own.
   ------------------------------------------------------------ */
router.get("/:outing_id", async (req, res) => {
  try {
    const userId = req.user?.auth_user_id;

    const doc = await Outing.findOne({
      outing_id: req.params.outing_id,
      auth_user_id: userId
    }).select({ auth_user_id: 0, admin_id: 0 }).lean();

    if (!doc) {
      return res.status(404).json({ issue: "not_found", message: "Outing request not found" });
    }

    return res.json({ success: true, data: doc });

  } catch (err) {
    console.error("Outing GetOne Error →", err);
    return res.status(500).json({ issue: "server_error" });
  }
});

/* ------------------------------------------------------------
   DELETE /bs1/outing/:outing_id
   Student cancels their own PENDING request.
   ------------------------------------------------------------ */
router.delete("/:outing_id", async (req, res) => {
  try {
    const userId = req.user?.auth_user_id;

    const doc = await Outing.findOne({
      outing_id: req.params.outing_id,
      auth_user_id: userId
    });

    if (!doc) {
      return res.status(404).json({ issue: "not_found", message: "Outing request not found" });
    }

    if (doc.status !== "pending") {
      return res.status(403).json({
        issue: "not_cancellable",
        message: `Cannot cancel an outing that is already '${doc.status}'`
      });
    }

    doc.status = "cancelled";
    doc.updated_at = Date.now();
    await doc.save();

    return res.json({ success: true, message: "Outing request cancelled successfully" });

  } catch (err) {
    console.error("Outing Cancel Error →", err);
    return res.status(500).json({ issue: "server_error" });
  }
});

// ===============================================================
// ADMIN ROUTES  (same prefix /bs1/outing, role checked internally)
// ===============================================================

/* ------------------------------------------------------------
   GET /bs1/outing/admin/all
   Admin lists ALL outing requests with rich filters.
   Query: status, auth_user_id, student_name, student_roll_number,
          student_department, student_year, student_hostel_block,
          student_gender, date_start, date_end,
          created_from, created_to, page, limit
   ------------------------------------------------------------ */
router.get("/admin/all", async (req, res) => {
  try {
    const adminAuthId = req.user?.auth_user_id;

    const admin = await Faculty.findOne({
      auth_user_id: adminAuthId,
      role: "admin",
      is_blocked: false
    }).lean();

    if (!admin) {
      return res.status(403).json({
        issue: "unauthorized_admin",
        message: "Only admins can access all outing requests"
      });
    }

    const q = {};

    if (req.query.outing_id) q.outing_id = req.query.outing_id;
    if (req.query.auth_user_id) q.auth_user_id = req.query.auth_user_id;
    if (req.query.status) q.status = req.query.status;
    if (req.query.student_name) q.student_name = new RegExp(req.query.student_name, "i");
    if (req.query.student_roll_number) q.student_roll_number = req.query.student_roll_number;
    if (req.query.student_department) q.student_department = req.query.student_department;
    if (req.query.student_year) q.student_year = req.query.student_year;
    if (req.query.student_hostel_block) q.student_hostel_block = req.query.student_hostel_block;
    if (req.query.student_gender) q.student_gender = req.query.student_gender;
    if (req.query.student_room_number) q.student_room_number = req.query.student_room_number;

    if (req.query.date_start || req.query.date_end) {
      q.date = {};
      if (req.query.date_start) q.date.$gte = new Date(req.query.date_start);
      if (req.query.date_end) q.date.$lte = new Date(req.query.date_end);
    }

    if (req.query.created_from || req.query.created_to) {
      q.created_at = {};
      if (req.query.created_from) q.created_at.$gte = new Date(req.query.created_from);
      if (req.query.created_to) q.created_at.$lte = new Date(req.query.created_to);
    }

    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const [list, total] = await Promise.all([
      Outing.find(q).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
      Outing.countDocuments(q)
    ]);

    return res.json({
      success: true,
      page, limit, total,
      count: list.length,
      filters_applied: Object.keys(q),
      data: list
    });

  } catch (err) {
    console.error("Admin Outing List Error →", err);
    return res.status(500).json({ issue: "server_error" });
  }
});

/* ------------------------------------------------------------
   PATCH /bs1/outing/:outing_id/approve
   Admin approves a pending outing request.
   Body (optional): { admin_note }
   ------------------------------------------------------------ */
router.patch("/:outing_id/approve", async (req, res) => {
  try {
    const adminAuthId = req.user?.auth_user_id;

    const admin = await Faculty.findOne({
      auth_user_id: adminAuthId,
      role: "admin",
      is_blocked: false
    }).lean();

    if (!admin) {
      return res.status(403).json({
        issue: "unauthorized_admin",
        message: "Only admins can approve outing requests"
      });
    }

    const doc = await Outing.findOne({ outing_id: req.params.outing_id });

    if (!doc) {
      return res.status(404).json({ issue: "not_found", message: "Outing request not found" });
    }

    if (doc.status !== "pending") {
      return res.status(403).json({
        issue: "not_actionable",
        message: `Cannot approve an outing that is already '${doc.status}'`
      });
    }

    doc.admin_id = admin.auth_user_id;
    doc.admin_name = admin.name;
    doc.admin_note = req.body?.admin_note?.trim() || "Approved";
    doc.admin_action_at = new Date();
    doc.status = "approved";
    doc.updated_at = Date.now();

    await doc.save();

    return res.json({
      success: true,
      message: "Outing request approved successfully.",
      data: {
        outing_id: doc.outing_id,
        status: doc.status,
        admin_name: doc.admin_name,
        admin_note: doc.admin_note,
        admin_action_at: doc.admin_action_at
      }
    });

  } catch (err) {
    console.error("Admin Outing Approve Error →", err);
    return res.status(500).json({ issue: "server_error" });
  }
});

/* ------------------------------------------------------------
   PATCH /bs1/outing/:outing_id/reject
   Admin rejects a pending outing request.
   Body (optional): { admin_note }
   ------------------------------------------------------------ */
router.patch("/:outing_id/reject", async (req, res) => {
  try {
    const adminAuthId = req.user?.auth_user_id;

    const admin = await Faculty.findOne({
      auth_user_id: adminAuthId,
      role: "admin",
      is_blocked: false
    }).lean();

    if (!admin) {
      return res.status(403).json({
        issue: "unauthorized_admin",
        message: "Only admins can reject outing requests"
      });
    }

    const doc = await Outing.findOne({ outing_id: req.params.outing_id });

    if (!doc) {
      return res.status(404).json({ issue: "not_found", message: "Outing request not found" });
    }

    if (doc.status !== "pending") {
      return res.status(403).json({
        issue: "not_actionable",
        message: `Cannot reject an outing that is already '${doc.status}'`
      });
    }

    doc.admin_id = admin.auth_user_id;
    doc.admin_name = admin.name;
    doc.admin_note = req.body?.admin_note?.trim() || "Rejected";
    doc.admin_action_at = new Date();
    doc.status = "rejected";
    doc.updated_at = Date.now();

    await doc.save();

    return res.json({
      success: true,
      message: "Outing request rejected.",
      data: {
        outing_id: doc.outing_id,
        status: doc.status,
        admin_name: doc.admin_name,
        admin_note: doc.admin_note,
        admin_action_at: doc.admin_action_at
      }
    });

  } catch (err) {
    console.error("Admin Outing Reject Error →", err);
    return res.status(500).json({ issue: "server_error" });
  }
});

// ===============================================================
// EXPORT
// ===============================================================
export default router;
export { Outing };
