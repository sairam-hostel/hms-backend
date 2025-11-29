const express = require("express");
const router = express.Router();
const { Faculty } = require("../accounts/creation-faculty");
const { Student } = require("../accounts/creation-students")

// =========================
// DELETE USER BY EMAIL
// =========================
router.delete("/", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        issue: "missing_fields",
        message: "email is required"
      });
    }

    const deleted = await Faculty.findOneAndDelete({ email: email.toLowerCase() });

    if (!deleted) {
      const deleted = await Student.findOneAndDelete({ email: email.toLowerCase() });
      if(!deleted)
      {
          return res.status(404).json({
          issue: "not_found",
          message: "No such user found"
        });
      }
      else{
          return res.status(404).json({
          issue: "not_found",
          message: "No such user found"
        });
      }

    }

    return res.json({
      success: true,
      message: "User deleted",
      data: {
        auth_user_id: deleted.auth_user_id,
        email: deleted.email,
        name: deleted.name
      }
    });

  } catch (err) {
    console.error("Delete Error:", err);
    return res.status(500).json({
      issue: "server_error",
      message: "Internal server error"
    });
  }
});

// =========================
// EXPORT CORRECTLY
// =========================
module.exports = { router };
