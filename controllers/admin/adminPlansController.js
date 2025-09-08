// controllers/admin/adminPlansController.js
const Plan = require("../../models/planModel");

// @desc    Get all plans
// @route   GET /api/admin/plans
// @access  Private/Admin
const getAllPlans = async (req, res) => {
  try {
    const plans = await Plan.find();
    res.json({
      success: true,
      count: plans.length,
      data: plans,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// @desc    Get single plan by ID
// @route   GET /api/admin/plans/:id
// @access  Private/Admin
const getPlanById = async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid plan ID" });
    }
    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      return res
        .status(404)
        .json({ success: false, message: "Plan not found" });
    }
    res.json({ success: true, data: plan });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// @desc    Create new plan
// @route   POST /api/admin/plans
// @access  Private/Admin
const createPlan = async (req, res) => {
  try {
    const {
      name,
      price,
      pricePeriod,
      description,
      features,
      isPopular,
      isActive,
    } = req.body;
    // Validate required fields
    if (!name || typeof name !== "string") {
      return res
        .status(400)
        .json({
          success: false,
          message: "Name is required and must be a string",
        });
    }
    if (price === undefined || typeof price !== "number" || price < 0) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Price is required and must be a non-negative number",
        });
    }
    if (pricePeriod && typeof pricePeriod !== "string") {
      return res
        .status(400)
        .json({ success: false, message: "Price period must be a string" });
    }
    if (features && !Array.isArray(features)) {
      return res
        .status(400)
        .json({ success: false, message: "Features must be an array" });
    }
    // Check if plan already exists
    const planExists = await Plan.findOne({ name });
    if (planExists) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Plan with this name already exists",
        });
    }
    const plan = await Plan.create({
      name,
      price,
      pricePeriod: pricePeriod || "month",
      description,
      features: features || [],
      isPopular: isPopular || false,
      isActive: isActive || true,
    });
    res
      .status(201)
      .json({
        success: true,
        message: "Plan created successfully",
        data: plan,
      });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// @desc    Update plan
// @route   PUT /api/admin/plans/:id
// @access  Private/Admin
const updatePlan = async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid plan ID" });
    }
    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      return res
        .status(404)
        .json({ success: false, message: "Plan not found" });
    }
    // Validate fields if present
    if (req.body.name && typeof req.body.name !== "string") {
      return res
        .status(400)
        .json({ success: false, message: "Name must be a string" });
    }
    if (
      req.body.price !== undefined &&
      (typeof req.body.price !== "number" || req.body.price < 0)
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Price must be a non-negative number",
        });
    }
    if (req.body.pricePeriod && typeof req.body.pricePeriod !== "string") {
      return res
        .status(400)
        .json({ success: false, message: "Price period must be a string" });
    }
    if (req.body.features && !Array.isArray(req.body.features)) {
      return res
        .status(400)
        .json({ success: false, message: "Features must be an array" });
    }
    // Check if name is being changed and if it conflicts with another plan
    if (req.body.name && req.body.name !== plan.name) {
      const planExists = await Plan.findOne({ name: req.body.name });
      if (planExists) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Plan with this name already exists",
          });
      }
    }
    const updatedPlan = await Plan.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    res.json({
      success: true,
      message: "Plan updated successfully",
      data: updatedPlan,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// @desc    Delete plan
// @route   DELETE /api/admin/plans/:id
// @access  Private/Admin
const deletePlan = async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid plan ID" });
    }
    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      return res
        .status(404)
        .json({ success: false, message: "Plan not found" });
    }
    await Plan.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Plan deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// @desc    Toggle plan status
// @route   PATCH /api/admin/plans/:id/status
// @access  Private/Admin
const togglePlanStatus = async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid plan ID" });
    }
    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      return res
        .status(404)
        .json({ success: false, message: "Plan not found" });
    }
    plan.isActive = !plan.isActive;
    await plan.save();
    res.json({
      success: true,
      message: `Plan ${
        plan.isActive ? "activated" : "deactivated"
      } successfully`,
      data: plan,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

module.exports = {
  getAllPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
  togglePlanStatus,
};
