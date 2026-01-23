

import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { Student } from "../accounts/creation-students.js";

const router = express.Router();


router.post("/login", async (req, res) => {
  try {
    const { email, password, device } = req.body;
    // console.log("[STUDENT LOGIN] attempt —", { email, device });

    if (!email || !password) {
    //   console.log("[STUDENT LOGIN] missing_fields —", req.body);
      return res.status(400).json({
        issue: "missing_fields",
        message: "email and password are required"
      });
    }

    const student = await Student.findOne({ email: email.toLowerCase() });
    // console.log("[STUDENT LOGIN] DB lookup result:", student);

    if (!student) {
    //   console.log("[STUDENT LOGIN] no account found for email:", email);
      return res.status(404).json({
        issue: "not_found",
        message: "Account does not exist"
      });
    }

    // 🔒 New: check email verification flag
    if (student.email_verified === false) {
    //   console.log("[STUDENT LOGIN] email not verified:", email);
      return res.status(403).json({
        issue: "email_not_verified",
        message: "Please verify your email address. Check your inbox (or spam)."
      });
    }

    const valid = await bcrypt.compare(password, student.password);
    // console.log("[STUDENT LOGIN] password match result for", email, ":", valid);

    if (!valid) {
      return res.status(401).json({
        issue: "invalid_credentials",
        message: "Incorrect email or password"
      });
    }

    const accessToken = jwt.sign(
      {
        auth_user_id: student.auth_user_id,
        role: student.role || "student"
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_ACCESS_EXPIRES || "15m" }
    );

    // console.log("[STUDENT LOGIN] success — issuing token for", email);

    return res.json({
      success: true,
      message: "Login successful",
      data: {
        access_token: accessToken,
        user: {
          id: student._id,
          auth_user_id: student.auth_user_id,
          name: student.name,
          email: student.email,
          role: student.role || "student"
        }
      }
    });
  } catch (err) {
    // console.error("Student Auth Login Error:", err);
    return res.status(500).json({
      issue: "server_error",
      message: "Internal server error"
    });
  }
});

export default router;