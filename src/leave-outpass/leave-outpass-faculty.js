import express from "express";
import crypto from "crypto";

import { LeaveOutpass } from "./leave-outpass-students.js";
import { Faculty } from "../accounts/creation-faculty.js";
import { Student } from "../accounts/creation-students.js";
const router = express.Router();


function hiddenProjection() {
  return {
    mentor_id: 0,
    mentor_note: 0,

    hod_id: 0,
    hod_note: 0,

    admin_id: 0,
    admin_note: 0,

    gate_verified_by: 0,
    qr_payload: 0,
    qr_signature: 0,

     password:0,

    action_history: 0,
    __v: 0
  };
}


  // ======================================================================
  // ADMIN: GET LEAVE / OUTPASS REQUESTS (WITH STUDENT DATA)
  // ======================================================================
  router.get("/", async (req, res) => {
    try {
      const q = {};

      // ------------------------------------------------
      // BASIC FILTERS
      // ------------------------------------------------
      if (req.query.request_id) q.request_id = req.query.request_id;
      if (req.query.auth_user_id) q.auth_user_id = req.query.auth_user_id;
      if (req.query.type) q.type = req.query.type;
      if (req.query.status) q.status = req.query.status;
      if (req.query.current_level) q.current_level = req.query.current_level;

      // ------------------------------------------------
      // DATE FILTERS
      // ------------------------------------------------
      if (req.query.from_date) {
        q.from_date = { $gte: new Date(req.query.from_date) };
      }
      if (req.query.to_date) {
        q.to_date = { $lte: new Date(req.query.to_date) };
      }

      // ------------------------------------------------
      // SAFE TEXT SEARCH
      // ------------------------------------------------
      if (req.query.search && req.query.search.trim() !== "") {
        const r = new RegExp(req.query.search.trim(), "i");
        q.$or = [
          { request_reason: r },
          { place_to_visit: r },
          { address_details: r }
        ];
      }

      // ------------------------------------------------
      // FETCH LEAVE / OUTPASS
      // ------------------------------------------------
      const leaveList = await LeaveOutpass
        .find(q)
        .sort({ created_at: -1 })
        .lean();

      // // 🔍 DEBUG: log first leave/outpass
      // if (leaveList.length > 0) {
      //   console.log("🔹 FIRST LEAVE/OUTPASS:", leaveList[0]);
      // }

      if (!leaveList.length) {
        return res.json({
          success: true,
          count: 0,
          data: []
        });
      }

      // ------------------------------------------------
      // FETCH STUDENTS
      // ------------------------------------------------
      const authUserIds = [...new Set(
        leaveList.map(l => l.auth_user_id)
      )];

      // console.log("🔹 AUTH USER IDS FROM LEAVE:", authUserIds);

      const students = await Student
        .find({ auth_user_id: { $in: authUserIds } })
        .select(hiddenProjection())
        .lean();

      // // 🔍 DEBUG: log first student
      // if (students.length > 0) {
      //   console.log("🔹 FIRST STUDENT:", students[0]);
      // } else {
      //   console.warn("⚠️ NO STUDENTS FOUND FOR THESE AUTH IDS");
      // }

      // ------------------------------------------------
      // MAP auth_user_id → student
      // ------------------------------------------------
      const studentMap = {};
      for (const s of students) {
        studentMap[s.auth_user_id] = s;
      }

      // ------------------------------------------------
      // MERGE ROW-WISE
      // ------------------------------------------------
      const data = leaveList.map(l => ({
        ...l,
        student: studentMap[l.auth_user_id] || null
      }));

      // ------------------------------------------------
      // RESPONSE
      // ------------------------------------------------
      return res.json({
        success: true,
        count: data.length,
        data
      });

    } catch (err) {
      console.error("Admin Leave List Error:", err);
      return res.status(500).json({
        success: false,
        issue: "server_error",
        message: "Internal server error"
      });
    }
  });

// ======================================================================
// ADMIN: APPROVE REQUEST (FACULTY-SOURCE LOGGING)
// ======================================================================
router.patch("/:request_id/approve", async (req, res) => {
  try {
    const adminAuthId = req.user?.auth_user_id;

    // 1️⃣ Fetch admin faculty record
    const admin = await Faculty.findOne({
      auth_user_id: adminAuthId,
      role: "admin",
      is_blocked: false
    }).lean();

    if (!admin) {
      return res.status(403).json({ issue: "unauthorized_admin" });
    }

    // 2️⃣ Fetch leave request
    const doc = await LeaveOutpass.findOne({
      request_id: req.params.request_id
    });

    if (!doc) {
      return res.status(404).json({ issue: "not_found" });
    }

    if (doc.current_level !== "admin" || doc.admin_status !== "pending") {
      return res.status(403).json({ issue: "not_actionable" });
    }

    // 3️⃣ Optional date edits
    const { from_date, to_date, return_date, admin_note } = req.body;
    if (from_date) doc.from_date = new Date(from_date);
    if (to_date) doc.to_date = new Date(to_date);
    if (return_date) doc.return_date = new Date(return_date);

    // 4️⃣ Log admin snapshot (FROM FACULTY)
    doc.admin = admin.auth_user_id;
    doc.admin_name = admin.name;
    doc.admin_email = admin.email;
    doc.admin_phone = admin.phone || null;

    // 5️⃣ Apply approval
    doc.admin_status = "approved";
    doc.admin_note = admin_note || "Approved";
    doc.admin_action_at = new Date();

    doc.current_level = "completed";
    doc.status = "approved";
    doc.updated_at = new Date();

    await doc.save();

    return res.json({
      success: true,
      message: "Request approved successfully."
    });

  } catch (err) {
    console.error("ADMIN APPROVE Error:", err);
    return res.status(500).json({ issue: "server_error" });
  }
});

// ======================================================================
// ADMIN: REJECT REQUEST (FACULTY-SOURCE LOGGING)
// ======================================================================
router.patch("/:request_id/reject", async (req, res) => {
  try {
    const adminAuthId = req.user?.auth_user_id;

    const admin = await Faculty.findOne({
      auth_user_id: adminAuthId,
      role: "admin",
      is_blocked: false
    }).lean();

    if (!admin) {
      return res.status(403).json({ issue: "unauthorized_admin" });
    }

    const doc = await LeaveOutpass.findOne({
      request_id: req.params.request_id
    });

    if (!doc) {
      return res.status(404).json({ issue: "not_found" });
    }

    if (doc.current_level !== "admin" || doc.admin_status !== "pending") {
      return res.status(403).json({ issue: "not_actionable" });
    }

    // Log admin snapshot
    doc.admin = admin.auth_user_id;
    doc.admin_email = admin.email;
    doc.admin_phone = admin.phone || null;

    // Apply rejection
    doc.admin_status = "rejected";
    doc.admin_note = req.body.admin_note || "Rejected";
    doc.admin_action_at = new Date();

    doc.status = "rejected";
    doc.current_level = "admin";
    doc.updated_at = new Date();

    await doc.save();

    return res.json({
      success: true,
      message: "Request rejected."
    });

  } catch (err) {
    console.error("ADMIN REJECT Error:", err);
    return res.status(500).json({ issue: "server_error" });
  }
});




// // ======================================================================
// // 6. GATE OUT (student leaves campus)
// // ======================================================================
// router.post("/gate-out", async (req, res) => {
//   try {
//     const { qr_payload, qr_signature } = req.body;

//     const expected = crypto
//       .createHmac("sha256", QR_SECRET)
//       .update(qr_payload)
//       .digest("hex");

//     if (expected !== qr_signature) {
//       return res.status(403).json({ issue: "invalid_qr" });
//     }

//     const payload = JSON.parse(Buffer.from(qr_payload, "base64").toString());
//     const doc = await LeaveOutpass.findOne({ request_id: payload.req });

//     if (!doc) return res.status(404).json({ issue: "not_found" });
//     if (doc.gate_out_time) return res.status(409).json({ issue: "already_out" });

//     doc.gate_out_time = Date.now();
//     doc.location_status = "outside";

//     doc.action_history.push({
//       action: "gate_out",
//       actor: "gate_scanner",
//       timestamp: Date.now()
//     });

//     await doc.save();

//     return res.json({ success: true, message: "Gate OUT recorded." });

//   } catch (err) {
//     console.error("GATE-OUT Error:", err);
//     return res.status(500).json({ issue: "server_error" });
//   }
// });



// // ======================================================================
// // 7. GATE IN (student returns)
// // ======================================================================
// router.post("/gate-in", async (req, res) => {
//   try {
//     const { qr_payload, qr_signature } = req.body;

//     const expected = crypto
//       .createHmac("sha256", QR_SECRET)
//       .update(qr_payload)
//       .digest("hex");

//     if (expected !== qr_signature) {
//       return res.status(403).json({ issue: "invalid_qr" });
//     }

//     const payload = JSON.parse(Buffer.from(qr_payload, "base64").toString());
//     const doc = await LeaveOutpass.findOne({ request_id: payload.req });

//     if (!doc) return res.status(404).json({ issue: "not_found" });
//     if (!doc.gate_out_time) return res.status(409).json({ issue: "not_left_yet" });
//     if (doc.gate_in_time) return res.status(409).json({ issue: "already_in" });

//     doc.gate_in_time = Date.now();
//     doc.location_status = "inside";

//     doc.action_history.push({
//       action: "gate_in",
//       actor: "gate_scanner",
//       timestamp: Date.now()
//     });

//     await doc.save();

//     return res.json({ success: true, message: "Gate IN recorded." });

//   } catch (err) {
//     console.error("GATE-IN Error:", err);
//     return res.status(500).json({ issue: "server_error" });
//   }
// });

// // EXPORT ROUTER
export default router;



