// src/dashboard/dashboard-faculty.js

import express from "express";
import mongoose from "mongoose";
import crypto from "crypto";
import { getNoticeCounts, getRecentNotices, getStudentCountYearWise, getTotalMembers } from "./dashboard-functions.js";

const router = express.Router();

// ===============================================================
// FACULTY DASHBOARD SCHEMA ARRAY (100 Fields)
// ===============================================================

const FacultyDashboardSchemaArray = [

  // ==========================================================
  // IDENTIFIERS & META
  // ==========================================================
  { key: "dashboard_id", type: "String", required: true, unique: true },
  { key: "generated_for", type: "String", enum: ["faculty", "warden", "admin"], required: true },
  { key: "generated_date", type: "Date", required: true },
  { key: "last_updated", type: "Date" },

  // ==========================================================
  // PEOPLE COUNTS
  // ==========================================================
  { key: "total_students", type: "Number" },
  { key: "total_faculty", type: "Number" },
  { key: "total_wardens", type: "Number" },
  { key: "total_people", type: "Number" },

  // ==========================================================
  // STUDENT YEAR-WISE COUNT
  // ==========================================================
  { key: "students_year_1", type: "Number" },
  { key: "students_year_2", type: "Number" },
  { key: "students_year_3", type: "Number" },
  { key: "students_year_4", type: "Number" },
  { key: "students_pg", type: "Number" },
  { key: "students_phd", type: "Number" },

  // ==========================================================
  // DEPARTMENT-WISE COUNT
  // ==========================================================
  { key: "dept_cse_students", type: "Number" },
  { key: "dept_ece_students", type: "Number" },
  { key: "dept_eee_students", type: "Number" },
  { key: "dept_mech_students", type: "Number" },
  { key: "dept_civil_students", type: "Number" },
  { key: "dept_it_students", type: "Number" },
  { key: "dept_ai_ds_students", type: "Number" },

  // ==========================================================
  // STUDENT CATEGORY & CGPA
  // ==========================================================
  { key: "students_above_75_percent", type: "Number" },
  { key: "students_below_75_percent", type: "Number" },
  { key: "students_above_8_cgpa", type: "Number" },
  { key: "students_below_6_cgpa", type: "Number" },
  { key: "cgpa_verification_pending", type: "Number" },
  { key: "mentor_approval_pending", type: "Number" },

  // ==========================================================
  // HOSTEL & ACCOMMODATION
  // ==========================================================
  { key: "total_hostels", type: "Number" },
  { key: "boys_hostel_count", type: "Number" },
  { key: "girls_hostel_count", type: "Number" },
  { key: "hostel_type_ac", type: "Number" },
  { key: "hostel_type_non_ac", type: "Number" },
  { key: "rooms_total", type: "Number" },
  { key: "rooms_occupied", type: "Number" },
  { key: "rooms_vacant", type: "Number" },

  // ==========================================================
  // LEAVE / OUTPASS ANALYTICS
  // ==========================================================
  { key: "leave_requests_today", type: "Number" },
  { key: "outpass_requests_today", type: "Number" },
  { key: "leave_pending", type: "Number" },
  { key: "leave_approved", type: "Number" },
  { key: "leave_rejected", type: "Number" },
  { key: "students_outside_hostel", type: "Number" },
  { key: "students_inside_hostel", type: "Number" },
  { key: "overdue_returns", type: "Number" },

  // ==========================================================
  // BIOMETRICS & SECURITY
  // ==========================================================
  { key: "biometric_active_accounts", type: "Number" },
  { key: "biometric_disabled_accounts", type: "Number" },
  { key: "students_vacated_today", type: "Number" },
  { key: "security_alerts_today", type: "Number" },

  // ==========================================================
  // REQUESTS & APPROVALS
  // ==========================================================
  { key: "total_requests", type: "Number" },
  { key: "pending_requests", type: "Number" },
  { key: "approved_requests", type: "Number" },
  { key: "rejected_requests", type: "Number" },

  // ==========================================================
  // GUEST & FOOD
  // ==========================================================
  { key: "guest_visits_today", type: "Number" },
  { key: "guest_food_count", type: "Number" },
  { key: "preferred_food_veg", type: "Number" },
  { key: "preferred_food_nonveg", type: "Number" },

  // ==========================================================
  // NOTICES & COMMUNICATION
  // ==========================================================
  { key: "total_notices", type: "Number" },
  { key: "active_notices", type: "Number" },
  { key: "expired_notices", type: "Number" },
  { key: "emergency_notices", type: "Number" },

  // ==========================================================
  // HOLIDAYS & RULE COMPLIANCE
  // ==========================================================
  { key: "sat_sun_holidays", type: "Boolean", default: true },
  { key: "rule_violations_today", type: "Number" },
  { key: "girls_outing_parent_required", type: "Number" },
  { key: "od_parent_informed", type: "Number" },

  // ==========================================================
  // SYSTEM METADATA
  // ==========================================================
  { key: "created_at", type: "Date", default: "Date.now" },
  { key: "updated_at", type: "Date", default: "Date.now" }
];


// GET /api/dashboard
router.get("/", async (req, res) => {
  try {
    const now = new Date();

    const dashboard = {
      dashboard_id: crypto.randomUUID(),
      generated_for: "faculty",
      generated_date: now,
      last_updated: now,

      // PEOPLE COUNTS
      total_students: 1240,
      total_faculty: 82,
      total_wardens: 12,
      total_people: 1334,

      // YEAR-WISE
      students_year_1: 320,
      students_year_2: 310,
      students_year_3: 300,
      students_year_4: 260,
      students_pg: 40,
      students_phd: 10,

      // DEPARTMENT-WISE
      dept_cse_students: 420,
      dept_ece_students: 280,
      dept_eee_students: 190,
      dept_mech_students: 170,
      dept_civil_students: 120,
      dept_it_students: 45,
      dept_ai_ds_students: 15,

      // CATEGORY & CGPA
      students_above_75_percent: 980,
      students_below_75_percent: 260,
      students_above_8_cgpa: 410,
      students_below_6_cgpa: 95,
      cgpa_verification_pending: 38,
      mentor_approval_pending: 22,

      // HOSTEL
      total_hostels: 6,
      boys_hostel_count: 4,
      girls_hostel_count: 2,
      hostel_type_ac: 2,
      hostel_type_non_ac: 4,
      rooms_total: 640,
      rooms_occupied: 610,
      rooms_vacant: 30,

      // LEAVE / OUTPASS
      leave_requests_today: 18,
      outpass_requests_today: 54,
      leave_pending: 12,
      leave_approved: 410,
      leave_rejected: 26,
      students_outside_hostel: 147,
      students_inside_hostel: 1093,
      overdue_returns: 3,

      // BIOMETRICS
      biometric_active_accounts: 1215,
      biometric_disabled_accounts: 25,
      students_vacated_today: 6,
      security_alerts_today: 1,

      // REQUESTS
      total_requests: 1860,
      pending_requests: 24,
      approved_requests: 1780,
      rejected_requests: 56,

      // GUEST & FOOD
      guest_visits_today: 31,
      guest_food_count: 68,
      preferred_food_veg: 44,
      preferred_food_nonveg: 24,

      // NOTICES
      total_notices: 95,
      active_notices: 14,
      expired_notices: 76,
      emergency_notices: 5,

      // HOLIDAYS & RULES
      sat_sun_holidays: true,
      rule_violations_today: 2,
      girls_outing_parent_required: 8,
      od_parent_informed: 17,

      // META
      created_at: now,
      updated_at: now
    };

    return res.status(200).json({
      success: true,
      message: "Faculty dashboard data (dummy)",
      data: dashboard
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      issue: "DASHBOARD_FETCH_FAILED",
      error: err.message
    });
  }
});

router.get("/upper-info", async (req, res) => {
  try
  {
    const data={
      total_students: getTotalMembers("students"),
      total_faculty: getTotalMembers("faculties"),
      total_wardens: getTotalMembers("faculties"),
      total_notices: getNoticeCounts("active")
    }
    return res.status(200).json({
      success: true,
      message: "Faculty dashboard data (dummy)",
      data
    });
  }
  catch(err)
  {
    return res.status(500).json({
      success: false,
      issue: "DASHBOARD_FETCH_FAILED",
      error: err.message
    });
  }
});

router.get("/getStudentCountYear-wise", async (req, res) => {
  try
  {
    const data={
      students_year_1: getStudentCountYearWise("1"),
      students_year_2: getStudentCountYearWise("2"),
      students_year_3: getStudentCountYearWise("3"),
      students_year_4: getStudentCountYearWise("4"),
      students_pg: 0,
      students_phd: 0,
    }
    return res.status(200).json({
      success: true,
      message: "Faculty dashboard data (dummy)",
      data
    });
  }
  catch(err)
  {
    return res.status(500).json({
      success: false,
      issue: "DASHBOARD_FETCH_FAILED",
      error: err.message
    });
  }
});

router.get("/getStudentCountDepartmentWise", async (req, res) => {
  try
  {
    const data={
      dept_cse_students: 420,
      dept_ece_students: 280,
      dept_eee_students: 190,
      dept_mech_students: 170,
      dept_civil_students: 120,
      dept_it_students: 45,
      dept_ai_ds_students: 15,
    }
    return res.status(200).json({
      success: true,
      message: "Faculty dashboard data (dummy)",
      data
    });
  }
  catch(err)
  {
    return res.status(500).json({
      success: false,
      issue: "DASHBOARD_FETCH_FAILED",
      error: err.message
    });
  }
});

router.get("/getRecentNotices", async (req, res) => {
  try
  {
    const data=getRecentNotices(5);
    return res.status(200).json({
      success: true,
      message: "Faculty dashboard data (dummy)",
      data
    });
  }
  catch(err)
  {
    return res.status(500).json({
      success: false,
      issue: "DASHBOARD_FETCH_FAILED",
      error: err.message
    });
  }
});

// EXPORT ROUTER
export default router;