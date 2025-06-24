const User = require("../models/userModel");

exports.getDefaultOptions = (req, res) => {
  try {
    const defaultOptions = {
      helps: [
        "Managing Sales pipelines",
        "Organizing key relationships",
        "Process automation",
        "Something else"
      ],
      goals: [
        "For personal use",
        "Testing for my company/team",
        "Other"
      ],
      categories: [
        "Sales", "Marketing", "IT", "Procurement", "Consultant",
        "C-Level", "HR", "Field Representative", "Freelancer", "Other"
      ],
      employeeCounts: [
        "1-4", "5-19", "20-49", "50-99", "100-249",
        "250-499", "500-999", "1000+"
      ]
    };

    res.status(200).json({ status: "success", defaultOptions });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

exports.submitUserOnboarding = async (req, res) => {
  try {
    const {
      helps = [],
      goals = [],
      categories = [],
      employeeCount = "",
      companyName = "",
      isFirstCRM = false
    } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ status: "error", message: "User not found" });
    }

    // Ensure userInfo object exists
    if (!user.userInfo) user.userInfo = {};

    user.userInfo.helps = helps;
    user.userInfo.goals = goals;
    user.userInfo.categories = categories;
    user.userInfo.employeeCount = employeeCount;
    user.userInfo.companyName = companyName;
    user.userInfo.isFirstCRM = isFirstCRM;

    await user.save();

    res.status(200).json({
      status: "success",
      message: "User onboarding data saved",
      userInfo: user.userInfo
    });
  } catch (error) {
    console.error("Onboarding error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to save onboarding data",
      error: error.message
    });
  }
};


exports.getUserOnboardingData = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("userInfo email");

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    res.status(200).json({
      status: "success",
      userId: user._id,
      email: user.email,
      userInfo: user.userInfo,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Failed to fetch user onboarding data",
      error: error.message,
    });
  }
};

