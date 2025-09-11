const User = require("../models/userModel");
const { createHmac, randomBytes } = require("crypto");

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "Current password and new password are required",
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        message: "New password must be different from current password",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "New password must be at least 6 characters long",
      });
    }

    const userId = req.user._id;
    const user = await User.findById(userId).select("+salt +password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user has a password (some users might have signed up with Google/Social)
    if (!user.password || !user.salt) {
      return res.status(400).json({
        message:
          "Cannot change password for accounts that signed up with social providers",
      });
    }

    // ✅ Verify current password
    const hashedCurrentPassword = createHmac("sha256", user.salt)
      .update(currentPassword)
      .digest("hex");

    if (hashedCurrentPassword !== user.password) {
      return res.status(400).json({
        message: "Current password is incorrect",
      });
    }

    // ✅ Generate new salt & hash for new password
    const salt = randomBytes(16).toString();
    const hashedNewPassword = createHmac("sha256", salt)
      .update(newPassword)
      .digest("hex");

    // ✅ Update with new hashed password
    await User.updateOne(
      { _id: userId },
      { $set: { password: hashedNewPassword, salt } }
    );

    return res.status(200).json({
      status: "success",
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
};

module.exports = { changePassword };
