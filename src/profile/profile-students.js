// src/accounts/student-profile.js
const express = require("express");
const router = express.Router();

const { Student } = require("../accounts/creation-students");

// GET /profile/student — get profile of logged-in student
router.get("/", async (req, res) => {
  try {
    const authUserId = req.user && req.user.auth_user_id;
    if (!authUserId) {
      return res.status(401).json({ issue: "unauthorized", message: "Invalid token / not logged in." });
    }

    const student = await Student.findOne({ auth_user_id: authUserId }).select("-password");
    if (!student) {
      return res.status(404).json({ issue: "not_found", message: "Student not found." });
    }

    return res.json({ success: true, data: student });
  } catch (err) {
    console.error("Student Profile Fetch Error:", err);
    return res.status(500).json({ issue: "server_error", message: "Internal server error." });
  }
});

module.exports = router;
