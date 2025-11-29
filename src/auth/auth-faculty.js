const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const Faculty = require("../accounts/creation-faculty").Faculty;


// ==============================
// LOGIN ONLY
// ==============================
router.post("/login", async (req, res) => {
  try {
    const { email, password, device } = req.body;
    if (!email || !password) {
      return res.status(400).json({ issue: "missing_fields", message: "email and password are required" });
    }

    const faculty = await Faculty.findOne({ email: email.toLowerCase() });
    if (!faculty) {
      return res.status(404).json({ issue: "not_found", message: "Account does not exist" });
    }

    // 🔒 New: check email verified flag
    if (!faculty.email_verified) {
      return res.status(403).json({
        issue: "email_not_verified",
        message: "Please verify your email address. Check your inbox (or spam)."
      });
    }

    const ok = await bcrypt.compare(password, faculty.password);
    if (!ok) {
      return res.status(401).json({ issue: "invalid_credentials", message: "Incorrect email or password" });
    }

    const accessToken = jwt.sign(
      { auth_user_id: faculty.auth_user_id, role: faculty.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_ACCESS_EXPIRES || "15m" }
    );

    return res.json({
      success: true,
      message: "Login successful",
      data: { access_token: accessToken,
              user: 
              { 
                id: faculty._id,
                auth_user_id: faculty.auth_user_id,
                name: faculty.name,
                email: faculty.email,
                role: faculty.role 
              } 
            }
    });

  } catch (err) {
    console.error("Auth Login Error:", err);
    return res.status(500).json({ issue: "server_error", message: "Internal server error" });
  }
});

module.exports = router;
