const mongoose = require("mongoose");
const User = require("../../models/userModel");
const Contact = require("../../models/contactModel");

exports.deleteMultipleUsers = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "userIds array is required",
      });
    }

    // 🔍 Fetch users to validate
    const users = await User.find({ _id: { $in: userIds } }).session(session);

    if (!users.length) {
      return res.status(404).json({
        status: "error",
        message: "No users found",
      });
    }

    // 🚫 Prevent deleting superadmin
    const hasSuperAdmin = users.some((u) => u.role === "superadmin");
    if (hasSuperAdmin) {
      return res.status(403).json({
        status: "error",
        message: "Superadmin users cannot be deleted",
      });
    }

    // 🧹 Delete Contacts created by users
    await Contact.deleteMany(
      { createdBy: { $in: userIds } },
      { session }
    );

    // 🧹 Delete Users
    await User.deleteMany(
      { _id: { $in: userIds } },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      status: "success",
      message: "Users and all related data deleted successfully",
      deletedUsersCount: userIds.length,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("Superadmin delete error:", error);

    return res.status(500).json({
      status: "error",
      message: "Failed to delete users",
    });
  }
};
