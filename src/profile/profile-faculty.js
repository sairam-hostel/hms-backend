// src/accounts/faculty-profile.js
const express = require("express");
const router = express.Router();

const { Faculty } = require("../accounts/creation-faculty");

// GET /profile/faculty — get profile of logged-in faculty
router.get("/", async (req, res) => {
  try {
    const authUserId = req.user && req.user.auth_user_id;
    if (!authUserId) {
      return res.status(401).json({ issue: "unauthorized", message: "Invalid token / not logged in." });
    }

    const faculty = await Faculty.findOne({ auth_user_id: authUserId }).select("-password");
    if (!faculty) {
      return res.status(404).json({ issue: "not_found", message: "Faculty not found." });
    }

    return res.json({ success: true, data: faculty });
  } catch (err) {
    console.error("Faculty Profile Fetch Error:", err);
    return res.status(500).json({ issue: "server_error", message: "Internal server error." });
  }
});

module.exports = router;
