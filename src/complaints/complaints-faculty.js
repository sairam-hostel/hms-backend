import express from "express";
import mongoose from "mongoose";

import verify from "../common/middleware.js";
import { Complaint } from "./complaints-students.js";

const router = express.Router();

// -------------------------
// Faculty-only Middleware
// -------------------------
function onlyFaculty(req, res, next) {
  if (req.user.role !== "faculty") {
    return res.status(403).json({ issue: "forbidden", message: "Faculty only" });
  }
  next();
}

// -----------------------------
// LIST ALL COMPLAINTS (FACULTY)
// -----------------------------
router.get("/", verify, onlyFaculty, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      category,
      student,
      search
    } = req.query;

    const skip = (page - 1) * limit;

    // Base filter
    const filters = {};

    if (status) filters.status = status;
    if (category) filters.category = category;
    if (student) filters.auth_user_id = student;

    // Search in title or description
    if (search) {
      filters.$or = [
        { title: new RegExp(search, "i") },
        { description: new RegExp(search, "i") }
      ];
    }

    const list = await Complaint.find(filters)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Complaint.countDocuments(filters);

    return res.json({
      success: true,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total_items: total,
        total_pages: Math.ceil(total / limit)
      },
      count: list.length,
      data: list
    });

  } catch (err) {
    console.error("Complaint Faculty List Error:", err);
    return res.status(500).json({ issue: "server_error" });
  }
});


// ----------------------------------
// FACULTY — VIEW A SINGLE COMPLAINT
// ----------------------------------
router.get("/:id", verify, onlyFaculty, async (req, res) => {
  try {
    const complaint = await Complaint.findOne({
      complaint_id: req.params.id
    });

    if (!complaint) {
      return res.status(404).json({ issue: "not_found" });
    }

    // Mark as seen by faculty
    await Complaint.updateOne(
      { complaint_id: req.params.id },
      { $addToSet: { seen_by_faculty: req.user.auth_user_id } }
    );

    return res.json({ success: true, data: complaint });

  } catch (err) {
    console.error("Complaint Faculty View Error:", err);
    return res.status(500).json({ issue: "server_error" });
  }
});
// ----------------------------------
// FACULTY — UPDATE COMPLAINT STATUS
// ----------------------------------
router.patch("/status/:id", verify, onlyFaculty, async (req, res) => {
  try {
    const { status, faculty_note } = req.body;

    if (!status) {
      return res.status(400).json({
        issue: "missing_status",
        message: "Status required"
      });
    }

    const facultyId = req.user.auth_user_id;

    const updated = await Complaint.findOneAndUpdate(
      { complaint_id: req.params.id },
      {
        $set: {
          status,
          faculty_note,
          faculty_incharge_id: facultyId,
          updated_at: Date.now()
        },
        $addToSet: {
          seen_by: facultyId       // 🔥 add faculty to seen_by
        }
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ issue: "not_found" });
    }

    return res.json({ success: true, data: updated });

  } catch (err) {
    console.error("Complaint Status Update Error:", err);
    return res.status(500).json({ issue: "server_error" });
  }
});

// ----------------------------------
// FACULTY — MARK AS SEEN
// ----------------------------------
router.post("/:id/seen", verify, onlyFaculty, async (req, res) => {
  try {
    const facultyId = req.user.auth_user_id;

    await Complaint.updateOne(
      { complaint_id: req.params.id },
      { 
        $addToSet: { seen_by: facultyId },   // 🔥 add faculty to seen_by
        $set: { updated_at: Date.now() }
      }
    );

    return res.json({ success: true, message: "Complaint marked as seen" });

  } catch (err) {
    console.error("Complaint Seen Error:", err);
    return res.status(500).json({ issue: "server_error" });
  }
});



// ----------------------------------
// FACULTY — RESOLVE COMPLAINT
// ----------------------------------
router.post("/:id/resolve", verify, onlyFaculty, async (req, res) => {
  try {
    const { resolution_summary, faculty_note } = req.body;

    const updated = await Complaint.findOneAndUpdate(
      { complaint_id: req.params.id },
      {
        $set: {
          status: "resolved",
          resolution_summary: resolution_summary || null,
          faculty_note: faculty_note || null,
          resolved_at: new Date(),
          faculty_incharge_id: req.user.auth_user_id,   // who resolved it
          updated_at: Date.now()
        },
        $addToSet: {
          seen_by: req.user.auth_user_id               // faculty mark as seen
        }
      },
      { new: true }
    );

    if (!updated)
      return res.status(404).json({ issue: "not_found" });

    return res.json({ success: true, data: updated });

  } catch (err) {
    console.error("Complaint Resolve Error:", err);
    return res.status(500).json({ issue: "server_error" });
  }
});

export default router;