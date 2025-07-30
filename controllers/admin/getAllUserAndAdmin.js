const User = require("../../models/userModel");

const getAllUsersAndAdmins = async (req, res) => {
  try {
    const currentUser = req.user; // set by auth middleware

    // // Ensure requester is a superadmin
    // if (currentUser.role !== "superadmin") {
    //   return res.status(403).json({
    //     status: "error",
    //     message: "Access denied. Super Admin only.",
    //   });
    // }

    // Fetch all admins and users (excluding superadmins if needed)
    const admins = await User.find({ role: "admin" }).select("-password");
    const users = await User.find({ role: "user" }).select("-password");

    return res.status(200).json({
      status: "success",
      message: "All admins and users fetched successfully.",
      data: {
        admins,
        users,
      },
    });
  } catch (error) {
    console.error("Error fetching users and admins:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error.",
    });
  }
};

module.exports = { getAllUsersAndAdmins };
