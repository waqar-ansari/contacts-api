// routes/planRoutes.js
const express = require("express");
const router = express.Router();
const { addOrEditPlan } = require("../../controllers/admin/addEditPlanController");

router.post("/", addOrEditPlan); // POST for both add/edit

module.exports = router;
