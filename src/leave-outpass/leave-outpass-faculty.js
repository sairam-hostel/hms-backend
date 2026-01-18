const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const { LeaveOutpass } = require("./leave-outpass-students");   // model import
const mentorEmailTemplate = require("../templates/mentor-html.js")
// HMAC SECRET (should come from env)
const APPROVAL_SECRET = process.env.LEAVE_OUTPASS_SECRET_KEYS;




// ======================================================================
// ADMIN: GET LEAVE / OUTPASS REQUESTS (ALL NON-SYSTEM FILTERS)
// ======================================================================
router.get("/", async (req, res) => {
  try {
    const q = {};

    // ================= IDENTIFIERS =================
    if (req.query.request_id) q.request_id = req.query.request_id;
    if (req.query.auth_user_id) q.auth_user_id = req.query.auth_user_id;

    // ================= REQUEST CORE =================
    if (req.query.type) q.type = req.query.type; // leave | outpass
    if (req.query.status) q.status = req.query.status;
    if (req.query.current_level) q.current_level = req.query.current_level;

    // ================= APPROVAL STATES =================
    if (req.query.mentor_status) q.mentor_status = req.query.mentor_status;
    if (req.query.hod_status) q.hod_status = req.query.hod_status;
    if (req.query.admin_status) q.admin_status = req.query.admin_status;

    // ================= AUTHORITIES =================
    if (req.query.mentor_email) q.mentor_email = req.query.mentor_email;
    if (req.query.hod_email) q.hod_email = req.query.hod_email;
    if (req.query.admin_email) q.admin_email = req.query.admin_email;

    // ================= REQUEST DETAILS =================
    if (req.query.mode_of_transport) q.mode_of_transport = req.query.mode_of_transport;

    // ================= PICKUP PERSON =================
    if (req.query.pickup_person_name) q.pickup_person_name = req.query.pickup_person_name;
    if (req.query.pickup_person_relation) q.pickup_person_relation = req.query.pickup_person_relation;
    if (req.query.pickup_person_phone) q.pickup_person_phone = req.query.pickup_person_phone;
    if (req.query.pickup_person_id_type) q.pickup_person_id_type = req.query.pickup_person_id_type;

    // ================= LOCATION & GATE =================
    if (req.query.location_status) q.location_status = req.query.location_status;
    if (req.query.escalation_level) q.escalation_level = req.query.escalation_level;
    if (req.query.is_gate_in_missed !== undefined) {
      q.is_gate_in_missed = req.query.is_gate_in_missed === "true";
    }

    // ================= DATE FILTERS =================
    if (req.query.from_date) {
      q.from_date = { $gte: new Date(req.query.from_date) };
    }

    if (req.query.to_date) {
      q.to_date = { $lte: new Date(req.query.to_date) };
    }

    if (req.query.return_date) {
      q.return_date = new Date(req.query.return_date);
    }

    if (req.query.created_from || req.query.created_to) {
      q.created_at = {};
      if (req.query.created_from) {
        q.created_at.$gte = new Date(req.query.created_from);
      }
      if (req.query.created_to) {
        q.created_at.$lte = new Date(req.query.created_to);
      }
    }

    // ================= SAFE TEXT SEARCH =================
    if (req.query.search) {
      const r = new RegExp(req.query.search, "i");
      q.$or = [
        { request_reason: r },
        { place_to_visit: r },
        { address_details: r }
      ];
    }

    const list = await LeaveOutpass
      .find(q)
      .sort({ created_at: -1 })
      .lean();

    return res.json({
      success: true,
      filters_applied: Object.keys(q),
      count: list.length,
      data: list
    });

  } catch (err) {
    console.error("Admin GET Error:", err);
    return res.status(500).json({ issue: "server_error" });
  }
});




// // ======================================================================
// // 3. GET INDIVIDUAL REQUEST
// // ======================================================================
// router.get("/:request_id", async (req, res) => {
//   try {
//     const doc = await LeaveOutpass.findOne({
//       request_id: req.params.request_id
//     });

//     if (!doc) return res.status(404).json({ issue: "not_found" });

//     return res.json({ success: true, data: doc });

//   } catch (err) {
//     console.error("Faculty GET ONE Error:", err);
//     return res.status(500).json({ issue: "server_error" });
//   }
// });



// // ======================================================================
// // 4. APPROVE REQUEST (faculty action)
// // ======================================================================
// router.patch("/:request_id/approve", async (req, res) => {
//   try {
//     const facultyId = req.user?.auth_user_id;
//     const doc = await LeaveOutpass.findOne({ request_id: req.params.request_id });

//     if (!doc) return res.status(404).json({ issue: "not_found" });
//     if (doc.status !== "pending") {
//       return res.status(403).json({ issue: "not_pending" });
//     }

//     // faculty can modify dates
//     const { from_date, to_date, return_date, faculty_note } = req.body;
//     if (from_date) doc.from_date = from_date;
//     if (to_date) doc.to_date = to_date;
//     if (return_date) doc.return_date = return_date;

//     doc.status = "approved";
//     doc.faculty_reviewer_id = facultyId;
//     doc.faculty_note = faculty_note || "Approved";
//     doc.approved_at = Date.now();

//     // Generate QR now
//     const { base64Payload, signature } = generateQR(doc);
//     doc.qr_payload = base64Payload;
//     doc.qr_signature = signature;
//     doc.qr_generated_at = Date.now();

//     doc.action_history.push({
//       action: "approved",
//       actor: facultyId,
//       timestamp: Date.now(),
//       note: doc.faculty_note
//     });

//     await doc.save();

//     return res.json({
//       success: true,
//       message: "Request Approved. QR generated.",
//       qr_payload: doc.qr_payload,
//       qr_signature: doc.qr_signature
//     });

//   } catch (err) {
//     console.error("APPROVE Error:", err);
//     return res.status(500).json({ issue: "server_error" });
//   }
// });



// // ======================================================================
// // 5. REJECT REQUEST
// // ======================================================================
// router.patch("/:request_id/reject", async (req, res) => {
//   try {
//     const facultyId = req.user?.auth_user_id;
//     const doc = await LeaveOutpass.findOne({ request_id: req.params.request_id });

//     if (!doc) return res.status(404).json({ issue: "not_found" });
//     if (doc.status !== "pending") {
//       return res.status(403).json({ issue: "not_pending" });
//     }

//     doc.status = "rejected";
//     doc.faculty_reviewer_id = facultyId;
//     doc.faculty_note = req.body.faculty_note || "Rejected";
//     doc.rejected_at = Date.now();

//     doc.action_history.push({
//       action: "rejected",
//       actor: facultyId,
//       timestamp: Date.now(),
//       note: doc.faculty_note
//     });

//     await doc.save();

//     return res.json({ success: true, message: "Request rejected." });

//   } catch (err) {
//     console.error("REJECT Error:", err);
//     return res.status(500).json({ issue: "server_error" });
//   }
// });

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
module.exports = router;



