const Plan = require("../models/planModel");
const User = require("../models/userModel");

/**
 * Get all available plans
 */
exports.getPlans = async (req, res) => {
  try {
    const plans = await Plan.find({ isActive: true });
    res.status(200).json({ success: true, plans });
  } catch (error) {
    console.error("❌ Error fetching plans:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Purchase/activate a plan for a user
 */
exports.purchasePlan = async (req, res) => {
  try {
    const userId = req.user._id; // 👈 middleware should set req.user
    const { planId } = req.body;

    if (!planId) {
      return res.status(400).json({ success: false, message: "Plan ID is required" });
    }

    // ✅ Check if plan exists
    const plan = await Plan.findById(planId);
    if (!plan || !plan.isActive) {
      return res.status(404).json({ success: false, message: "Plan not found or inactive" });
    }

    // ✅ Update user with new plan
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    user.plan = plan._id;
    user.planActivatedAt = new Date();
    user.isPremium = plan.price !== "Free"; // Example: mark premium if not free
    await user.save();

    res.status(200).json({
      success: true,
      message: `Plan '${plan.name}' activated successfully`,
      plan,
    });
  } catch (error) {
    console.error("❌ Error purchasing plan:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
