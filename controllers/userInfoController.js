const User = require("../models/userModel");

exports.completeUserInfo = async (req, res) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized: User ID not found",
      });
    }

    const { helps, companyName, isFirstCRM, industry } = req.body;

    if (!helps || !Array.isArray(helps) || !companyName || typeof isFirstCRM !== "boolean" || !industry) {
      return res.status(400).json({
        status: "error",
        message: "All fields (helps[], companyName, isFirstCRM, industry) are required",
      });
    }

    const allowedIndustries = ["Agency", "Real Estate", "Software/Technology", "Financial Services"];
    if (!allowedIndustries.includes(industry)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid industry selected",
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        userInfo: {
          helps,
          companyName,
          isFirstCRM,
          industry,
        },
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "User information updated successfully",
      data: user.userInfo,
    });
  } catch (error) {
    console.error("Error in completeUserInfo:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};
