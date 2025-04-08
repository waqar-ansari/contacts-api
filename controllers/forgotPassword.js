const crypto = require("crypto");
const User = require("../models/userModel");

// In-memory token store (can be replaced by DB or Redis)
const resetTokens = new Map();

// Send reset link
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const resetToken = crypto.randomBytes(32).toString("hex");
    resetTokens.set(resetToken, email);

    const resetLink = `https://100rjobf76.execute-api.eu-north-1.amazonaws.com/auth/reset-password?token=${resetToken}`;
    console.log("🔗 Reset Link:", resetLink);

    // In production, send via email
    return res.status(200).json({ message: "Reset link sent", resetLink });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
};

// Reset password
const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword)
    return res.status(400).json({ message: "Token and new password required" });

  const email = resetTokens.get(token);
  if (!email)
    return res.status(400).json({ message: "Invalid or expired token" });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    user.password = newPassword; // Will hash via mongoose pre-save hook
    await user.save();

    resetTokens.delete(token);

    return res.status(200).json({ message: "Password reset successful" });
  } catch (err) {
    return res.status(500).json({ error: "Could not reset password" });
  }
};

module.exports = {
  forgotPassword,
  resetPassword,
};
