// controllers/admin/adminPlansController.js
const Plan = require("../../models/planModel");

// @desc    Get all plans
// @route   GET /api/admin/plans
// @access  Private/Admin
const getAllPlans = async (req, res) => {
  const plans = await Plan.find();
  res.json({
    success: true,
    count: plans.length,
    data: plans,
  });
};

// @desc    Get single plan by ID
// @route   GET /api/admin/plans/:id
// @access  Private/Admin
const getPlanById = async (req, res) => {
  const plan = await Plan.findById(req.params.id);

  if (!plan) {
    return res.status(404).json({
      success: false,
      message: "Plan not found",
    });
  }

  res.json({
    success: true,
    data: plan,
  });
};

// @desc    Create new plan
// @route   POST /api/admin/plans
// @access  Private/Admin
const createPlan = async (req, res) => {
  const {
    name,
    price,
    pricePeriod,
    description,
    features,
    isPopular,
    isActive,
  } = req.body;

  // Check if plan already exists
  const planExists = await Plan.findOne({ name });
  if (planExists) {
    return res.status(400).json({
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
  });

  res.status(201).json({
    success: true,
    message: "Plan created successfully",
    data: plan,
  });
};

// @desc    Update plan
// @route   PUT /api/admin/plans/:id
// @access  Private/Admin
const updatePlan = async (req, res) => {
  const plan = await Plan.findById(req.params.id);

  if (!plan) {
    return res.status(404).json({
      success: false,
      message: "Plan not found",
    });
  }

  // Check if name is being changed and if it conflicts with another plan
  if (req.body.name && req.body.name !== plan.name) {
    const planExists = await Plan.findOne({ name: req.body.name });
    if (planExists) {
      return res.status(400).json({
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
};

// @desc    Delete plan
// @route   DELETE /api/admin/plans/:id
// @access  Private/Admin
const deletePlan = async (req, res) => {
  const plan = await Plan.findById(req.params.id);

  if (!plan) {
    return res.status(404).json({
      success: false,
      message: "Plan not found",
    });
  }

  await Plan.findByIdAndDelete(req.params.id);

  res.json({
    success: true,
    message: "Plan deleted successfully",
  });
};

// @desc    Toggle plan status
// @route   PATCH /api/admin/plans/:id/status
// @access  Private/Admin
const togglePlanStatus = async (req, res) => {
  const plan = await Plan.findById(req.params.id);

  if (!plan) {
    return res.status(404).json({
      success: false,
      message: "Plan not found",
    });
  }

  plan.isActive = !plan.isActive;
  await plan.save();

  res.json({
    success: true,
    message: `Plan ${plan.isActive ? "activated" : "deactivated"} successfully`,
    data: plan,
  });
};

module.exports = {
  getAllPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
  togglePlanStatus,
};
