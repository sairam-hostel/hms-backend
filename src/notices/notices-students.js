import express from "express";
import mongoose from "mongoose";

import verify from "../common/middleware.js";
import { Notice } from "./notices-faculty.js";
import { Student } from "../accounts/creation-students.js";

const router = express.Router();



// -------------------------------------------------------------
// Helper: Smart targeting filters based on student profile
// -------------------------------------------------------------
async function buildTargetFilters(auth_user_id) {
  const stu = await Student.findOne({ auth_user_id }).lean();

  if (!stu) return {}; // fail safe

  return {
    $or: [
      { target_course: stu.course || null },
      { target_course: null },
      { target_course: "" },

      { target_year: stu.year || null },
      { target_year: null },
      { target_year: "" },

      { target_department: stu.department || null },
      { target_department: null },
      { target_department: "" },

      { target_gender: stu.gender || "all" },
      { target_gender: "all" }
    ]
  };
}

// -------------------------------------------------------------
// STUDENT — LIST ALL NOTICES (FULL LIST, student can filter)
// -------------------------------------------------------------
router.get("/", verify, async (req, res) => {
  if (req.user.role !== "student") {
    return res.status(403).json({ issue: "forbidden", message: "Students only" });
  }

  try {
    // -------------------------
    // PAGINATION
    // -------------------------
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    // -------------------------
    // BUILD FILTERS FROM QUERY
    // -------------------------
    const filters = {};

    if (req.query.category) filters.category = req.query.category;
    if (req.query.priority) filters.priority = req.query.priority;
    if (req.query.course) filters.target_course = req.query.course;
    if (req.query.year) filters.target_year = req.query.year;
    if (req.query.department) filters.target_department = req.query.department;
    if (req.query.gender) filters.target_gender = req.query.gender;

    if (req.query.search) {
      filters.$or = [
        { title: new RegExp(req.query.search, "i") },
        { message: new RegExp(req.query.search, "i") },
        { category: new RegExp(req.query.search, "i") },
      ];
    }

    if (req.query.from || req.query.to) {
      filters.created_at = {};
      if (req.query.from) filters.created_at.$gte = new Date(req.query.from);
      if (req.query.to) filters.created_at.$lte = new Date(req.query.to);
    }

    // -------------------------
    // FIND + PAGINATION
    // -------------------------
    const notices = await Notice.find(filters)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Notice.countDocuments(filters);

    return res.json({
      success: true,
      pagination: {
        page,
        limit,
        total_items: total,
        total_pages: Math.ceil(total / limit),
      },
      count: notices.length,
      data: notices
    });

  } catch (err) {
    console.error("Student Notice List Error:", err);
    return res.status(500).json({ issue: "server_error" });
  }
});

// -------------------------------------------------------------
// STUDENT — VIEW SINGLE NOTICE (always accessible, no restrictions)
// -------------------------------------------------------------
router.get("/:id", verify, async (req, res) => {
  if (req.user.role !== "student") {
    return res.status(403).json({ issue: "forbidden" });
  }

  try {
    const notice = await Notice.findOne({ notice_id: req.params.id });

    if (!notice)
      return res.status(404).json({ issue: "not_found" });

    const studentId = req.user.auth_user_id;
    const alreadySeen = notice.seen_by.includes(studentId);

    await Notice.updateOne(
      { notice_id: req.params.id },
      {
        $inc: { view_count: alreadySeen ? 0 : 1 },
        $addToSet: { seen_by: studentId }
      }
    );

    return res.json({ success: true, data: notice });

  } catch (err) {
    console.error("Student Notice Fetch Error:", err);
    return res.status(500).json({ issue: "server_error" });
  }
});


// -------------------------------------------------------------
// STUDENT — MARK NOTICE AS READ
// -------------------------------------------------------------
router.post("/:id", verify, async (req, res) => {
  if (req.user.role !== "student") {
    return res.status(403).json({ issue: "forbidden" });
  }

  try {
    await Notice.updateOne(
      { notice_id: req.params.id },
      { $addToSet: { seen_by: req.user.auth_user_id } }
    );

    return res.json({ success: true, message: "Notice marked as read" });

  } catch (err) {
    console.error("Student Notice Mark Read Error:", err);
    return res.status(500).json({ issue: "server_error" });
  }
});

export default router;
