import express from "express";
import verify from "../common/middleware.js";
import { FoodPass } from "./food-student.js";
import { ROLE_GROUPS } from "../common/roles.js";

const router = express.Router();

// -------------------------
// Faculty-only Middleware
// -------------------------
function onlyFaculty(req, res, next) {
  if (!ROLE_GROUPS.FACULTY.includes(req.user.role)) {
    return res.status(403).json({
      issue: "forbidden",
      message: "Only faculty/admin can perform this action"
    });
  }
  next();
}

router.get("/", verify, onlyFaculty, async (req, res) => {
  try {
    const query = {};

    if (req.query.status) {
      query.status = req.query.status; // pending | approved | rejected
    }

    const passes = await FoodPass.find(query)
      .sort({ created_at: -1 });

    return res.json({ success: true, data: passes });

  } catch (err) {
    console.error("FoodFaculty Get Error:", err);
    return res.status(500).json({
      issue: "server_error",
      message: "Could not fetch food passes"
    });
  }
});

router.get("/:pass_id", verify, onlyFaculty, async (req, res) => {
  try {
    const pass = await FoodPass.findOne({ pass_id: req.params.pass_id });

    if (!pass) {
      return res.status(404).json({
        issue: "not_found",
        message: "Food pass not found"
      });
    }

    return res.json({ success: true, data: pass });

  } catch (err) {
    console.error("FoodFaculty Get One Error:", err);
    return res.status(500).json({
      issue: "server_error",
      message: "Could not fetch food pass"
    });
  }
});

router.patch("/:pass_id/approve", verify, onlyFaculty, async (req, res) => {
  try {
    const pass = await FoodPass.findOne({ pass_id: req.params.pass_id });

    if (!pass) {
      return res.status(404).json({ issue: "not_found" });
    }

    if (pass.status !== "pending") {
      return res.status(400).json({
        issue: "already_processed",
        message: "Food pass already reviewed"
      });
    }

    await FoodPass.updateOne(
      { pass_id: req.params.pass_id },
      {
        $set: {
          status: "approved",
          reviewed_by: req.user.auth_user_id,
          reviewed_by_role: req.user.role,
          reviewed_at: Date.now(),
          updated_at: Date.now()
        }
      }
    );

    return res.json({
      success: true,
      message: "Food pass approved"
    });

  } catch (err) {
    console.error("FoodFaculty Approve Error:", err);
    return res.status(500).json({
      issue: "server_error",
      message: "Could not approve food pass"
    });
  }
});

router.patch("/:pass_id/reject", verify, onlyFaculty, async (req, res) => {

  const { review_comment } = req.body;

  if (!review_comment) {
    return res.status(400).json({
      issue: "comment_required",
      message: "Rejection comment is required"
    });
  }

  try {
    const pass = await FoodPass.findOne({ pass_id: req.params.pass_id });

    if (!pass) {
      return res.status(404).json({ issue: "not_found" });
    }

    if (pass.status !== "pending") {
      return res.status(400).json({
        issue: "already_processed",
        message: "Food pass already reviewed"
      });
    }

    await FoodPass.updateOne(
      { pass_id: req.params.pass_id },
      {
        $set: {
          status: "rejected",
          review_comment,
          reviewed_by: req.user.auth_user_id,
          reviewed_by_role: req.user.role,
          reviewed_at: Date.now(),
          updated_at: Date.now()
        }
      }
    );

    return res.json({
      success: true,
      message: "Food pass rejected"
    });

  } catch (err) {
    console.error("FoodFaculty Reject Error:", err);
    return res.status(500).json({
      issue: "server_error",
      message: "Could not reject food pass"
    });
  }
});

// EXPORT ROUTER
export default router;
