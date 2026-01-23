import express from "express";
import crypto from "crypto";

import verify from "../common/middleware.js";
const router = express.Router();


//--------------------------------------------------------------
// COMPLAINT SCHEMA (array → schema)
//--------------------------------------------------------------
import mongoose from "mongoose";
const ComplaintSchemaArray = [
  // IDENTIFIERS
  { key: "complaint_id", type: "String", required: true, unique: true },
  { key: "auth_user_id", type: "String", required: true }, // student

  // BASIC INFO
  { key: "title", type: "String", required: true },
  { key: "category", type: "String", enum: ["room", "mess", "hostel", "electric", "water", "discipline", "other"], required: true },
  { key: "description", type: "String", required: true },

  // LOCATION
  { key: "hostel_block", type: "String" },
  { key: "room_number", type: "String" },
  { key: "floor_number", type: "String" },

  // ATTACHMENTS
  { key: "attachments", type: "Array", default: [] },  // images, pdf, etc.

  // STATUS & RESOLUTION
  { key: "status", type: "String", enum: ["pending", "in_progress", "resolved", "rejected"], default: "pending" },
  { key: "faculty_incharge_id", type: "String" },
  { key: "faculty_note", type: "String" },
  { key: "resolution_summary", type: "String" },
  { key: "resolved_at", type: "Date" },
  { key: "rejected_at", type: "Date" },

  // IMPACT / TYPE
  { key: "severity", type: "String", enum: ["low", "medium", "high"], default: "medium" },
  { key: "is_emergency", type: "Boolean", default: false },

  // ACTIVITY
  { key: "view_count", type: "Number", default: 0 },
  { key: "seen_by", type: "Array", default: [] }, // faculty IDs

  // TIME
  { key: "created_at", type: "Date", default: "Date.now" },
  { key: "updated_at", type: "Date", default: "Date.now" }
];

// TYPE MAP
const typeMap = {
  String: String,
  Number: Number,
  Date: Date,
  Array: Array,
  Boolean: Boolean
};

// CONVERT ARRAY → SCHEMA OBJECT
const schemaObject = {};

ComplaintSchemaArray.forEach(f => {
  const field = { type: typeMap[f.type] };
  if (f.required) field.required = true;
  if (f.unique) field.unique = true;
  if (f.enum) field.enum = f.enum;

  if (f.default) {
    field.default = f.default === "Date.now" ? Date.now : f.default;
  }

  schemaObject[f.key] = field;
});

// FINAL MONGOOSE SCHEMA
const ComplaintSchema = new mongoose.Schema(schemaObject, { versionKey: false });

ComplaintSchema.pre("save", function () {
  this.updated_at = Date.now();
});

// MODEL
const Complaint = mongoose.model("Complaint", ComplaintSchema);

// Allowed fields for student creation
const allowedFields = [
  "title",
  "category",
  "description",
  "hostel_block",
  "room_number",
  "floor_number",
  "attachments",
  "severity",
  "is_emergency"
];

// Fields student CANNOT update
const protectedFields = [
  "complaint_id",
  "auth_user_id",
  "status",
  "faculty_incharge_id",
  "faculty_note",
  "resolution_summary",
  "resolved_at",
  "rejected_at",
  "action_history",
  "view_count",
  "seen_by",
  "created_at",
  "updated_at"
];


// -------------------------------------------------------------
// STUDENT — CREATE COMPLAINT
// -------------------------------------------------------------
router.post("/", verify, async (req, res) => {
  if (req.user.role !== "student")
    return res.status(403).json({ issue: "forbidden" });

  try {
    const incoming = {};
    Object.keys(req.body || {}).forEach(k => {
      if (allowedFields.includes(k)) incoming[k] = req.body[k];
    });

    incoming.complaint_id = crypto.randomUUID();
    incoming.auth_user_id = req.user.auth_user_id;

    const created = await Complaint.create(incoming);

    return res.json({ success: true, data: created });

  } catch (err) {
    console.error("Complaint Create Error:", err);
    res.status(500).json({ issue: "server_error" });
  }
});

// -------------------------------------------------------------
// STUDENT — GET ALL COMPLAINTS (Paginated)
// -------------------------------------------------------------
router.get("/", verify, async (req, res) => {
  if (req.user.role !== "student")
    return res.status(403).json({ issue: "forbidden" });

  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const filters = { auth_user_id: req.user.auth_user_id };

    if (req.query.status) filters.status = req.query.status;
    if (req.query.severity) filters.severity = req.query.severity;
    if (req.query.category) filters.category = req.query.category;

    const list = await Complaint.find(filters)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Complaint.countDocuments(filters);

    return res.json({
      success: true,
      pagination: {
        page,
        limit,
        total_items: total,
        total_pages: Math.ceil(total / limit)
      },
      count: list.length,
      data: list
    });

  } catch (err) {
    console.error("Complaint List Error:", err);
    res.status(500).json({ issue: "server_error" });
  }
});

// -------------------------------------------------------------
// STUDENT — GET SINGLE COMPLAINT
// -------------------------------------------------------------
router.get("/:id", verify, async (req, res) => {
  if (req.user.role !== "student")
    return res.status(403).json({ issue: "forbidden" });

  try {
    const complaint = await Complaint.findOne({
      complaint_id: req.params.id,
      auth_user_id: req.user.auth_user_id
    });

    if (!complaint)
      return res.status(404).json({ issue: "not_found" });

    return res.json({ success: true, data: complaint });

  } catch (err) {
    console.error("Complaint Fetch Error:", err);
    res.status(500).json({ issue: "server_error" });
  }
});

// -------------------------------------------------------------
// STUDENT — UPDATE COMPLAINT (PATCH only allowed before faculty sees it)
// -------------------------------------------------------------
router.patch("/:id", verify, async (req, res) => {
  if (req.user.role !== "student")
    return res.status(403).json({ issue: "forbidden" });

  try {
    const updates = { ...req.body };

    // Remove protected fields
    protectedFields.forEach(f => delete updates[f]);

    updates.updated_at = Date.now();

    // -----------------------------------------
    // UPDATE ONLY IF:
    //   1) complaint belongs to student
    //   2) faculty has NOT seen it yet (seen_by = empty)
    // -----------------------------------------
    const updated = await Complaint.findOneAndUpdate(
      {
        complaint_id: req.params.id,
        auth_user_id: req.user.auth_user_id,
        seen_by: { $size: 0 }   // <= KEY CHANGE
      },
      { $set: updates },
      { new: true }
    );

    if (!updated) {
      return res.status(400).json({
        issue: "cannot_update",
        message: "Complaint already viewed by faculty or not found"
      });
    }

    return res.json({ success: true, data: updated });

  } catch (err) {
    console.error("Complaint Update Error:", err);
    res.status(500).json({ issue: "server_error" });
  }
});

// -------------------------------------------------------------
// STUDENT — DELETE COMPLAINT (allowed only BEFORE seen_by)
// -------------------------------------------------------------
router.delete("/:id", verify, async (req, res) => {
  if (req.user.role !== "student")
    return res.status(403).json({ issue: "forbidden" });

  try {
    const complaint = await Complaint.findOne({
      complaint_id: req.params.id,
      auth_user_id: req.user.auth_user_id
    });

    if (!complaint)
      return res.status(404).json({ issue: "not_found" });

    // ❌ Cannot delete after faculty saw it
    if (complaint.seen_by && complaint.seen_by.length > 0) {
      return res.status(403).json({
        issue: "locked",
        message: "Cannot delete complaint after faculty has viewed it."
      });
    }

    await Complaint.deleteOne({
      complaint_id: req.params.id,
      auth_user_id: req.user.auth_user_id
    });

    return res.json({ success: true, message: "Complaint deleted." });

  } catch (err) {
    console.error("Complaint Delete Error:", err);
    res.status(500).json({ issue: "server_error" });
  }
});

export default router;
export {Complaint};