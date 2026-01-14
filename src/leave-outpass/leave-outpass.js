const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const { Student } = require("../accounts/creation-students");
const { LeaveOutpass } = require("./leave-outpass-students.js");
const getMentorReviewHTML = require("../templates/mentor-html.js");
const hodEmailTemplate = require("../templates/hod-email.js");
const {
  successPage,
  rejectPage,
  donePage,
  errorPage
} = require("../templates/response.js");

const { sendEmail } = require("../common/mailer");

const router = express.Router();
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

    // ✅ Fetch student info using leave.auth_user_id
    const student = await Student.findOne({
      auth_user_id: leave.auth_user_id
    }).lean();
    const actionUrl = `${process.env.API_BASE_URL }/bf1/review/mentor/respond`;
    // Pass both leave + student to template
    const html = getMentorReviewHTML({ leave, student, token, actionUrl });

    res.set("Content-Type", "text/html");
    res.send(html);

  } catch (err) {
    console.error("Mentor review render error:", err);
    return res.status(401).send("<p>Invalid or expired link</p>");
  }
});

const HOD_PORTAL_URL = process.env.HOD_PORTAL_URL;
const HOD_TOKEN_EXPIRE = process.env.HOD_TOKEN_EXPIRE;
router.post("/mentor/respond", async (req, res) => {
  try {
    const { token, action, remarks } = req.body;

    // 1️⃣ Token required
    if (!token) {
      return res.status(400).send(
        errorPage("Authorization token is missing.")
      );
    }

    // 2️⃣ Validate action
    if (!["approved", "rejected"].includes(action)) {
      return res.status(400).send(
        errorPage("Invalid action.")
      );
    }

    // 3️⃣ Verify JWT
    let decoded;
    try {
      decoded = jwt.verify(token, APPROVAL_SECRET);
    } catch {
      return res.status(401).send(
        errorPage("Invalid or expired approval link.")
      );
    }

    // 4️⃣ Fetch leave (LOCK ONLY IF ALREADY APPROVED)
    const leave = await LeaveOutpass.findOne({
      request_id: decoded.request_id,
      mentor_status: { $ne: "approved" }
    });

    if (!leave) {
      return res.status(410).send(
        donePage("This request has already been approved.")
      );
    }

    // 5️⃣ Update mentor decision
    leave.mentor_status = action;
    leave.mentor_note = remarks || null;
    leave.mentor_action_at = new Date();
    leave.updated_at = new Date();

    if (action === "approved") {
      leave.current_level = "hod";
    } else {
      // rejection → student can edit & mentor can act again
      leave.current_level = "mentor";
    }

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
        APPROVAL_SECRET
      );

      const approvalLink = `${HOD_PORTAL_URL}?token=${hodToken}`;

      await sendEmail({
        to: leave.hod_email,
        subject: "Leave / Outpass Pending Your Approval",
        html: hodEmailTemplate({
          hodName: leave.hod_name,
          studentName: student?.name || "Student",
          leaveType: leave.type,
          fromDate: new Date(leave.from_date).toDateString(),
          toDate: new Date(leave.to_date).toDateString(),
          approvalLink
        })
      });

      return res.send(
        successPage(
          "You have approved the request. It has been forwarded to the HOD."
        )
      );
    }

    // 7️⃣ Reject page
    return res.send(
      rejectPage(
        "You have rejected this request. The student may modify and resubmit."
      )
    );

  } catch (err) {
    console.error("Mentor respond error →", err);
    return res.status(500).send(
      errorPage("Something went wrong. Please try again.")
    );
  }
});

module.exports = { router };
