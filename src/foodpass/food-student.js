import crypto from "crypto";


const FoodPassSchemaArray = [

  // ==================================================
  // IDENTIFIERS
  // ==================================================
  { key: "pass_id", type: "String", required: true, unique: true },
  { key: "student_id", type: "String", required: true },

  // ==================================================
  // PASS DETAILS
  // ==================================================
  { key: "guest_count", type: "Number", required: true, min: 1 },
  { key: "meal_type", type: "String", enum: ["breakfast", "lunch", "dinner"], required: true },
  { key: "reason", type: "String" },

  // ==================================================
  // DATE (DAILY BASIS)
  // ==================================================
  { key: "pass_date", type: "Date", required: true },   // normalized to 00:00
  { key: "day", type: "String" },                       // Monday, Tuesday (derived)
  { key: "is_today", type: "Boolean", default: false },

  // ==================================================
  // APPROVAL FLOW
  // ==================================================
  { key: "status", type: "String", enum: ["pending", "approved", "rejected"], default: "pending" },
  { key: "reviewed_by", type: "String" },               // admin / warden id
  { key: "reviewed_by_role", type: "String" },          // admin / warden
  { key: "reviewed_at", type: "Date" },
  { key: "review_comment", type: "String" },

  // ==================================================
  // VISIBILITY / CONTROL
  // ==================================================
  { key: "is_active", type: "Boolean", default: true },
  { key: "is_cancelled", type: "Boolean", default: false },
  { key: "cancelled_at", type: "Date" },

  // ==================================================
  // AUDIT
  // ==================================================
  { key: "created_at", type: "Date", default: "Date.now" },
  { key: "updated_at", type: "Date", default: "Date.now" }
];

const FoodPassSchemaObject = {};

FoodPassSchemaArray.forEach(field => {
  const f = { type: typeMap[field.type] };

  if (field.required) f.required = true;
  if (field.unique) f.unique = true;
  if (field.enum) f.enum = field.enum;
  if (field.default)
    f.default = field.default === "Date.now" ? Date.now : field.default;

  FoodPassSchemaObject[field.key] = f;
});

const FoodPassSchema = new mongoose.Schema(FoodPassSchemaObject, { versionKey: false });

FoodPassSchema.pre("save", function () {
  this.updated_at = Date.now();
});

export const FoodPass = mongoose.model("FoodPass", FoodPassSchema);

const allowedCreateFields = [
  "pass_date","meal_type","meal_slot","guest_count",
  "adult_guests","child_guests","guest_relation",
  "guest_names","guest_contact","guest_vehicle_no",
  "expected_arrival_time","expected_departure_time",
  "veg_count","non_veg_count","special_diet",
  "diet_notes","allergy_info","extra_rice",
  "extra_sambar","extra_dessert","reason","food_comments"
];

function sanitizeForCreate(obj) {
  const out = {};
  Object.keys(obj || {}).forEach(key => {
    if (allowedCreateFields.includes(key)) {
      out[key] = obj[key];
    }
  });
  return out;
}

const protectedUpdateFields = [
  // IDENTIFIERS
  "pass_id", "student_id", "pass_date",
  "status", "approved_by", "approved_by_role",
  "approved_at", "rejected_by", "rejected_reason",
  "review_priority","auto_approved","mess_acknowledged",
  "mess_acknowledged_at","food_served", "food_served_time",
  "inventory_adjusted","inventory_ref_id","cost_estimate",
  "cost_actual", "security_checked", "entry_time",
  "exit_time", "qr_code", "qr_scanned",

  "is_active", "is_cancelled", "cancelled_by",
  "cancelled_at", "expired", "soft_deleted",

  "created_at",
  "updated_at",
  "edit_count",
  "edit_history"
];

router.post("/", verify, async (req, res) => {

  // 🔒 STUDENT ONLY
  if (req.user.role !== "student") {
    return res.status(403).json({
      issue: "forbidden",
      message: "Only students can create food passes."
    });
  }

  try {
    const incoming = sanitizeForCreate(req.body);

    // NOTE (future):
    // One student should be allowed to create only ONE food pass per day.
    // This can be enforced later using:
    // 1. pass_date normalization (00:00)
    // 2. compound unique index: { student_id, pass_date }

    // const passDate = new Date(incoming.pass_date);
    // passDate.setHours(0, 0, 0, 0);

    const newPass = await FoodPass.create({
      ...incoming,
      pass_id: crypto.randomUUID(),
      student_id: req.user.auth_user_id,
      // pass_date: passDate, // will be normalized later
      status: "pending",
      created_at: Date.now()
    });

    return res.json({
      success: true,
      data: newPass
    });

  } catch (err) {
    console.error("FoodPass Create Error:", err);
    return res.status(500).json({
      issue: "server_error",
      message: "Could not create food pass"
    });
  }
});

router.get("/", verify, async (req, res) => {
  try {
    let query = {};

    // Student sees only their own passes
    if (req.user.role === "student") {
      query.student_id = req.user.auth_user_id;
    }

    const passes = await FoodPass.find(query)
      .sort({ created_at: -1 });

    return res.json({ success: true, data: passes });

  } catch (err) {
    console.error("FoodPass Get All Error:", err);
    res.status(500).json({
      issue: "server_error",
      message: "Could not fetch food passes"
    });
  }
});

router.get("/:pass_id", verify, async (req, res) => {
  try {
    const pass = await FoodPass.findOne({ pass_id: req.params.pass_id });

    if (!pass) {
      return res.status(404).json({
        issue: "not_found",
        message: "Food pass not found"
      });
    }

    // Student can view only their own
    if (
      req.user.role === "student" &&
      pass.student_id !== req.user.auth_user_id
    ) {
      return res.status(403).json({ issue: "forbidden" });
    }

    return res.json({ success: true, data: pass });

  } catch (err) {
    console.error("FoodPass Get One Error:", err);
    res.status(500).json({
      issue: "server_error",
      message: "Could not fetch food pass"
    });
  }
});

router.patch("/:pass_id", verify, async (req, res) => {

  if (req.user.role !== "student") {
    return res.status(403).json({
      issue: "forbidden",
      message: "Only students can update food passes."
    });
  }

  try {
    const pass = await FoodPass.findOne({ pass_id: req.params.pass_id });

    if (!pass) {
      return res.status(404).json({ issue: "not_found" });
    }

    if (pass.student_id !== req.user.auth_user_id) {
      return res.status(403).json({ issue: "forbidden" });
    }

    // NOTE: Later you can block updates after approval
    // if (pass.status !== "pending") { ... }

    const updates = sanitizeForUpdate(req.body);

    await FoodPass.updateOne(
      { pass_id: req.params.pass_id },
      { $set: updates }
    );

    return res.json({ success: true });

  } catch (err) {
    console.error("FoodPass Patch Error:", err);
    res.status(500).json({
      issue: "server_error",
      message: "Could not update food pass"
    });
  }
});

router.put("/:pass_id", verify, async (req, res) => {

  if (req.user.role !== "student") {
    return res.status(403).json({ issue: "forbidden" });
  }

  try {
    const pass = await FoodPass.findOne({ pass_id: req.params.pass_id });

    if (!pass) {
      return res.status(404).json({ issue: "not_found" });
    }

    if (pass.student_id !== req.user.auth_user_id) {
      return res.status(403).json({ issue: "forbidden" });
    }

    const sanitized = sanitizeForCreate(req.body);

    const updated = await FoodPass.findOneAndUpdate(
      { pass_id: req.params.pass_id },
      {
        ...sanitized,
        updated_at: Date.now()
      },
      { new: true }
    );

    return res.json({ success: true, data: updated });

  } catch (err) {
    console.error("FoodPass Put Error:", err);
    res.status(500).json({
      issue: "server_error",
      message: "Could not replace food pass"
    });
  }
});

router.delete("/:pass_id", verify, async (req, res) => {

  if (req.user.role !== "student") {
    return res.status(403).json({ issue: "forbidden" });
  }

  try {
    const pass = await FoodPass.findOne({ pass_id: req.params.pass_id });

    if (!pass) {
      return res.status(404).json({ issue: "not_found" });
    }

    if (pass.student_id !== req.user.auth_user_id) {
      return res.status(403).json({ issue: "forbidden" });
    }

    // Soft delete (preferred)
    await FoodPass.updateOne(
      { pass_id: req.params.pass_id },
      { $set: { is_active: false, updated_at: Date.now() } }
    );

    return res.json({ success: true });

  } catch (err) {
    console.error("FoodPass Delete Error:", err);
    res.status(500).json({
      issue: "server_error",
      message: "Could not delete food pass"
    });
  }
});
