const User = require("../../models/userModel");

// GET all users
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ role: "user" })
      .select("firstname lastname email phonenumbers planExpiresAt")
      .populate({
        path: "plan",
        select: "name",
      });

    const activeCount = await User.countDocuments({
      role: "user",
      isActive: true,
    });
    const inactiveCount = await User.countDocuments({
      role: "user",
      isActive: false,
    });

    res.status(200).json({
      status: "success",
      message: "Users retrieved successfully",
      count: users.length,
      activeCount,
      inactiveCount,
      data: users,
    });
  } catch (err) {
    console.error("Get Users Error:", err);
    res.status(500).json({ status: "error", message: "Server error" });
  }
};

// GET single user by ID
const getUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findOne({ _id: id, role: "user" })
      .select("firstname lastname email phonenumbers planExpiresAt")
      .populate({
        path: "plan",
        select: "name",
      });

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    res.status(200).json({
      status: "success",
      message: "User retrieved successfully",
      data: user,
    });
  } catch (err) {
    console.error("Get User Error:", err);
    res.status(500).json({ status: "error", message: "Server error" });
  }
};

module.exports = { getAllUsers, getUser };
