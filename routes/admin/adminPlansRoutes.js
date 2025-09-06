// routes/admin/adminPlansRoutes.js
const express = require("express");
const router = express.Router();
const {
  getAllPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
  togglePlanStatus,
} = require("../../controllers/admin/adminPlansController");

// GET all plans
router.get("/", getAllPlans);

// GET single plan by ID
router.get("/:id", getPlanById);

// CREATE new plan
router.post("/", createPlan);

// UPDATE plan
router.put("/:id", updatePlan);

// DELETE plan
router.delete("/:id", deletePlan);

// TOGGLE plan status
router.patch("/:id/status", togglePlanStatus);

module.exports = router;
