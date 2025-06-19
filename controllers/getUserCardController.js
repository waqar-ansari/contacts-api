const User = require("../models/userModel");

exports.getUserInfo = async (req, res) => {
  try {
    const profileId = req.params.profileId; // e.g., "yash02"

    if (!profileId) {
      return res.status(400).json({
        status: "error",
        message: "Profile ID is required.",
      });
    }

    // Match letters (firstname) + at least 2 digits (serial)
    const match = profileId.match(/^([a-zA-Z]+)(\d{2,})$/);

    if (!match) {
      return res.status(400).json({
        status: "error",
        message: "Invalid profile ID format. Expected format: {firstname}{serialNumber}, e.g., yash02",
      });
    }

    const firstname = match[1];
    const serialNumber = match[2]; // keep as string

    const user = await User.findOne({
      firstname: new RegExp(`^${firstname}$`, "i"), // case-insensitive match
      serialNumber,
    }).select("firstname lastname email phonenumbers profileImageURL");

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



