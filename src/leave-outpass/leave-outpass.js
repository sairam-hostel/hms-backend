const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const { Student } = require("../accounts/creation-students");
const { LeaveOutpass } = require("./leave-outpass-students.js");
const getMentorReviewHTML = require("../templates/mentor-html.js");
const getHodReviewHTML = require("../templates/hod-html.js");
const hodEmailTemplate = require("../templates/hod-email.js");
const getActionResultHTML = require("../templates/response.js");
const { sendEmail } = require("../common/mailer");

const router = express.Router();
// HMAC SECRET (should come from env)
const APPROVAL_SECRET = process.env.LEAVE_OUTPASS_SECRET_KEYS;
router.get("/mentor", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ issue: "missing_token" });
    }

    const decoded = jwt.verify(token, APPROVAL_SECRET);

    const leave = await LeaveOutpass.findOne({
      request_id: decoded.request_id,
      mentor_email: decoded.email
    }).lean();

    if (!leave) {
      return res.status(404).json({ issue: "not_found" });
    }

    const student = await Student.findOne({
      auth_user_id: leave.auth_user_id
    }).lean();

    return res.json({ leave, student });

  } catch (err) {
    return res.status(401).json({ issue: "invalid_or_expired_token" });
  }
});

const HOD_PORTAL_URL = process.env.HOD_PORTAL_URL;
const HOD_TOKEN_EXPIRE = process.env.HOD_TOKEN_EXPIRE;
const RESPONSE_PORTAL_URL = process.env.HOD_PORTAL_URL;
router.post("/mentor/respond", async (req, res) => {
  try {
    const { token, action, remarks } = req.body;

    const RESPONSE_URL = process.env.RESPONSE_PORTAL_URL;

    // 1️⃣ Token required
    if (!token) {
      const t = createResultToken({
        status: "error",
        message: "Authorization token missing"
      });
      return res.redirect(`${RESPONSE_URL}?token=${t}`);
    }

    // 2️⃣ Validate action
    if (!["approved", "rejected"].includes(action)) {
      const t = createResultToken({
        status: "error",
        message: "Invalid action"
      });
      return res.redirect(`${RESPONSE_URL}?token=${t}`);
    }

    // 3️⃣ Verify approval JWT
    let decoded;
    try {
      decoded = jwt.verify(token, APPROVAL_SECRET);
    } catch {
      const t = createResultToken({
        status: "error",
        message: "Invalid or expired approval link"
      });
      return res.redirect(`${RESPONSE_URL}?token=${t}`);
    }

    // 4️⃣ Fetch leave
    // 🔒 Lock ONLY if already approved
    const leave = await LeaveOutpass.findOne({
      request_id: decoded.request_id,
      mentor_status: { $ne: "approved" }
    });

    if (!leave) {
      const t = createResultToken({
        status: "done",
        message: "This request has already been approved"
      });
      return res.redirect(`${RESPONSE_URL}?token=${t}`);
    }

    // 5️⃣ Apply mentor decision
    leave.mentor_status = action;
    leave.mentor_note = remarks || null;
    leave.mentor_action_at = new Date();
    leave.updated_at = new Date();

    // Approved → escalate, Rejected → editable again
    leave.current_level = action === "approved" ? "hod" : "mentor";

    await leave.save();

    // 6️⃣ Send HOD email ONLY on approval
    if (action === "approved" && leave.hod_email) {
      const student = await Student.findOne({
        auth_user_id: leave.auth_user_id
      }).lean();

      const hodToken = jwt.sign(
        {
          request_id: leave.request_id,
          role: "hod",
          email: leave.hod_email
        },
        APPROVAL_SECRET,
        process.env.HOD_TOKEN_EXPIRE &&
          process.env.HOD_TOKEN_EXPIRE !== "none"
          ? { expiresIn: process.env.HOD_TOKEN_EXPIRE }
          : undefined
      );

      const approvalLink = `${HOD_PORTAL_URL}?token=${hodToken}`;

      await sendEmail({
        to: leave.hod_email,
        subject: "Leave / Outpass HOD Approval Pending",
        html: hodEmailTemplate({
          hodName: leave.hod_name,
          studentName: student?.name || "Student",
          leaveType: leave.type,
          fromDate: new Date(leave.from_date).toDateString(),
          toDate: new Date(leave.to_date).toDateString(),
          approvalLink
        })
      });

      const t = createResultToken({
        status: "success",
        message: "You have approved the request. It has been forwarded to the HOD."
      });

      return res.redirect(`${RESPONSE_URL}?token=${t}`);
    }

    // 7️⃣ Rejected → student can edit & resubmit
    const t = createResultToken({
      status: "rejected",
      message: "You have rejected this request. The student may modify and resubmit."
    });

    return res.redirect(`${RESPONSE_URL}?token=${t}`);

  } catch (err) {
    console.error("Mentor respond error →", err);

    const t = createResultToken({
      status: "error",
      message: "Something went wrong. Please try again."
    });

    return res.redirect(
      `${process.env.RESPONSE_PORTAL_URL}?token=${t}`
    );
  }
});

router.post("/hod/respond", async (req, res) => {
  try {
    const { token, action, remarks } = req.body;

    const RESPONSE_URL = process.env.RESPONSE_PORTAL_URL;

    // 1️⃣ Token required
    if (!token) {
      const t = createResultToken({
        status: "error",
        message: "Authorization token missing"
      });
      return res.redirect(`${RESPONSE_URL}?token=${t}`);
    }

    // 2️⃣ Validate action
    if (!["approved", "rejected"].includes(action)) {
      const t = createResultToken({
        status: "error",
        message: "Invalid action"
      });
      return res.redirect(`${RESPONSE_URL}?token=${t}`);
    }

    // 3️⃣ Verify approval JWT
    let decoded;
    try {
      decoded = jwt.verify(token, APPROVAL_SECRET);
    } catch {
      const t = createResultToken({
        status: "error",
        message: "Invalid or expired approval link"
      });
      return res.redirect(`${RESPONSE_URL}?token=${t}`);
    }

    // 4️⃣ Fetch leave (lock if already approved by HOD)
    const leave = await LeaveOutpass.findOne({
      request_id: decoded.request_id,
      hod_status: { $ne: "approved" }
    });

    if (!leave) {
      const t = createResultToken({
        status: "done",
        message: "This request has already been approved"
      });
      return res.redirect(`${RESPONSE_URL}?token=${t}`);
    }

    // 5️⃣ Apply HOD decision
    leave.hod_status = action;
    leave.hod_note = remarks || null;
    leave.hod_action_at = new Date();
    leave.updated_at = new Date();

    // Approved → move forward, Rejected → student edits
    leave.current_level = action === "approved" ? "admin" : "hod";

    // Optional derived status update (safe)
    if (action === "rejected") {
      leave.status = "rejected";
    }

    // // Optional audit trail (recommended)
    // leave.action_history.push({
    //   level: "hod",
    //   action,
    //   remarks: remarks || null,
    //   acted_at: new Date()
    // });

    await leave.save();

    // 6️⃣ Approval success (NO EMAIL)
    if (action === "approved") {
      const t = createResultToken({
        status: "success",
        message: "You have approved the request. It has been forwarded to the next level."
      });
      return res.redirect(`${RESPONSE_URL}?token=${t}`);
    }

    // 7️⃣ Rejected → student can edit & resubmit
    const t = createResultToken({
      status: "rejected",
      message: "You have rejected this request. The student may modify and resubmit."
    });

    return res.redirect(`${RESPONSE_URL}?token=${t}`);

  } catch (err) {
    console.error("HOD respond error →", err);

    const t = createResultToken({
      status: "error",
      message: "Something went wrong. Please try again."
    });

    return res.redirect(
      `${process.env.RESPONSE_PORTAL_URL}?token=${t}`
    );
  }
});



router.get("/hod", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ issue: "missing_token" });
    }

    const decoded = jwt.verify(token, APPROVAL_SECRET);

    const leave = await LeaveOutpass.findOne({
      request_id: decoded.request_id,
      mentor_email: decoded.email
    }).lean();

    if (!leave) {
      return res.status(404).json({ issue: "not_found" });
    }

    const student = await Student.findOne({
      auth_user_id: leave.auth_user_id
    }).lean();

    return res.json({ leave, student });

  } catch (err) {
    return res.status(401).json({ issue: "invalid_or_expired_token" });
  }
});


//PAGES

router.get("/mentor-page", (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send("Token required");

  const html = getMentorReviewHTML({
    token,
    actionUrl: "/bf1/review/mentor/respond"
  });

  res.set("Content-Type", "text/html");
  res.send(html);
});

router.get("/hod-page", (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send("Token required");
  }

  const html = getHodReviewHTML({
    token,
    actionUrl: "/bf1/review/hod/respond"
  });

  res.set("Content-Type", "text/html");
  res.send(html);
});


router.get("/action-result", (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send("Invalid link");
  }

  let decoded;
  try {
    decoded = jwt.verify(token, APPROVAL_SECRET);
  } catch {
    return res.status(401).send("Invalid or expired result link");
  }

  const html = getActionResultHTML({
    status: decoded.status,
    message: decoded.message
  });

  res.set("Content-Type", "text/html");
  res.send(html);
});

function createResultToken(payload) {
  return jwt.sign(
    payload,
    APPROVAL_SECRET,
          process.env.RESULT_TOKEN_EXPIRE !== "none"
          ? { expiresIn: process.env.RESULT_TOKEN_EXPIRE }
          : undefined
  );
}


module.exports = { router };
