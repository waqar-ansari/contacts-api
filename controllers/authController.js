const crypto = require('crypto');
// const bcrypt = require('bcrypt');
const User = require('../models/userModel');
const sendEmail = require('../utils/sendEmail');

// Forgot Password - Send Reset Link
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ message: 'Email not found' });

    // Generate token
    const token = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // Reset link
    const resetLink = `http://localhost:3003/api/reset-password?token=${token}`;

    const html = `
      <p>You requested a password reset.</p>
      <p>Click <a href="${resetLink}">here</a> to reset your password.</p>
    `;

    await sendEmail(user.email, 'Reset Password', html);

    res.json({
      status: "success",
      message: "Password reset link sent to your email"
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: 'Server error', error: err.message });
  }
};

// Reset Password - Validate token and update password
exports.resetPassword = async (req, res) => {
  const { token } = req.query;
  const { password, confirmPassword } = req.body;

  if (!password || !confirmPassword) {
    return res.status(400).json({ message: 'Password and confirm password are required' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match' });
  }

  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    // // Hash password
    // const saltRounds = 10;
    // const hashedPassword = await bcrypt.hash(password, saltRounds);

    user.password = password;

    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res.json({
      status: "success",
      message: 'Password has been reset successfully'
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: 'Server error', error: err.message });
  }
};
