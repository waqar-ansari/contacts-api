const crypto = require("crypto");
const User = require("../models/userModel");

const changePassword = async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ message: "New passwords are required" });
    }

    const userId = req.user._id;

    // ✅ Make sure to select password and salt explicitly
    const user = await User.findById(userId).select("+password +salt");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // ✅ Hash old password
    // const hashedOldPassword = crypto
    //   .createHmac("sha256", user.salt)
    //   .update(oldPassword)
    //   .digest("hex");

    // ❌ Check if old password matches
    // if (hashedOldPassword !== user.password) {
    //   return res.status(400).json({ message: "Old password is incorrect" });
    // }

    // ✅ Hash new password
    // const hashedNewPassword = crypto
    //   .createHmac("sha256", user.salt)
    //   .update(newPassword)
    //   .digest("hex");

    // ✅ Update and save password
    await User.updateOne(
      { _id: userId },
      { $set: { password: newPassword } }
    );

    return res.status(200).json({
      status: "success",
      message: "Password changed successfully"
    });

  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
};

module.exports = { changePassword };
