const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const { LeaveOutpass } = require("./leave-outpass-students");   // model import
const mentorEmailTemplate = require("../templates/mentor-html.js")
// HMAC SECRET (should come from env)
const APPROVAL_SECRET = process.env.LEAVE_OUTPASS_SECRET_KEYS;

router.get("/mentor", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).send("<p>Error: token is required</p>");
    }

    const decoded = jwt.verify(token, APPROVAL_SECRET);

    const leave = await LeaveOutpass.findOne({
      request_id: decoded.request_id,
      mentor_email: decoded.email
    }).lean();

    if (!leave) {
      return res.status(404).send("<p>Leave request not found</p>");
    }

    const html = getMentorReviewHTML({ leave, token });

    res.set("Content-Type", "text/html");
    res.send(html);

  } catch (err) {
    console.error("Mentor review render error:", err);
    return res.status(401).send("<p>Invalid or expired link</p>");
  }
});

export default router;
// // ======================================================================
// // 1. Utility: Generate QR payload + HMAC signature
// // ======================================================================
// function generateQR(doc) {
//   const payload = {
//     req: doc.request_id,
//     uid: doc.auth_user_id,
//     ts: Date.now()
//   };

//   const base64Payload = Buffer.from(JSON.stringify(payload)).toString("base64");

//   const signature = crypto
//     .createHmac("sha256", QR_SECRET)
//     .update(base64Payload)
//     .digest("hex");

//   return { base64Payload, signature };
// }


// function validateQR(qr_payload, qr_signature) {
//   const expectedSig = crypto
//     .createHmac("sha256", process.env.QR_SECRET)
//     .update(qr_payload)
//     .digest("hex");

//   return expectedSig === qr_signature;
// }

// // Hide sensitive fields
// function hiddenProjection() {
//   return {
//     qr_signature: 0
//   };
// }

// // Helper: check inside/outside status
// function computeStatus(doc) {
//   if (doc.gate_out_time && !doc.gate_in_time) return "outside";
//   if (doc.gate_in_time) return "inside";
//   return "not_left_yet";
// }


// // ======================================================================
// // 2. GET ALL REQUESTS (with filters)
// // ======================================================================
// router.get("/", async (req, res) => {
//   try {
//     const q = {};

//     // filters
//     if (req.query.type) q.type = req.query.type;                             // leave | outpass
//     if (req.query.status) q.status = req.query.status;                       // pending | approved
//     if (req.query.auth_user_id) q.auth_user_id = req.query.auth_user_id;     // filter student
//     if (req.query.hostel_block) q.hostel_block = req.query.hostel_block;

//     // date filter
//     if (req.query.from_date) {
//       q.from_date = { $gte: new Date(req.query.from_date) };
//     }

//     const list = await LeaveOutpass.find(q).sort({ created_at: -1 });

//     return res.json({
//       success: true,
//       count: list.length,
//       data: list
//     });

//   } catch (err) {
//     console.error("Faculty GET ALL Error:", err);
//     return res.status(500).json({ issue: "server_error" });
//   }
// });



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
// module.exports = router;