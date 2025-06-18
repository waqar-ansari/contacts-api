const User = require("../models/userModel");

exports.getUserInfo = async (req, res) => {
  try {
    const profileId = req.params.profileId; // e.g., "ravi2"

    if (!profileId) {
      return res.status(400).json({
        status: "error",
        message: "Profile ID is required.",
      });
    }

    // Extract the serial number from the end of the string
    const match = profileId.match(/^(.+?)(\d+)$/); // Match name + digits at the end
    if (!match) {
      return res.status(400).json({
        status: "error",
        message: "Invalid profile ID format. Expected format: {name}{serialNumber}, e.g., ravi2",
      });
    }

    const serialNumber = parseInt(match[2], 10);
    if (isNaN(serialNumber)) {
      return res.status(400).json({
        status: "error",
        message: "Serial number is invalid or missing.",
      });
    }

    const user = await User.findOne({ serialNumber }).select("firstname lastname email phonenumbers");

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "User information retrieved successfully",
      data: user,
    });
  } catch (error) {
    console.error("Error in getUserInfo:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
};


