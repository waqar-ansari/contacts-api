// controllers/planController.js
const Plan = require("../../models/planModel");

const addOrEditPlan = async (req, res) => {
  try {
    const { id, name, price, description, features = [], isActive = true } = req.body;

    // Validate required fields
    if (!name || !price || !features) {
      return res.status(400).json({ status: "error", message: "Name and price are required" });
    }
    // Ensure features is an array
    if (!Array.isArray(features)) {
      return res.status(400).json({ status: "error", message: "Features must be an array" });
    }
    // Ensure isActive is a boolean
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ status: "error", message: "isActive must be a boolean" });
    }

    // Only admin allowed
    // if (req.user.role !== 'admin') {
    //   return res.status(403).json({ status: "error", message: "Access denied" });
    // }

    let plan;
    if (id) {
      // Update existing plan
      plan = await Plan.findByIdAndUpdate(id, {
        name, price, description, features, isActive
      }, { new: true });
      if (!plan) {
        return res.status(404).json({ status: "error", message: "Plan not found" });
      }
    } else {
      // Create new plan
      plan = new Plan({ name, price, description, features, isActive });
      await plan.save();
    }

    return res.status(200).json({
      status: "success",
      message: id ? "Plan updated successfully" : "Plan created successfully",
      data: plan
    });
  } catch (error) {
    console.error("Plan Add/Edit Error:", error);
    return res.status(500).json({ status: "error", message: "Internal server error" });
  }
};

module.exports = { addOrEditPlan };
