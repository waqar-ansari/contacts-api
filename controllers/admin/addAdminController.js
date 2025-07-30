const User = require("../../models/userModel");
const crypto = require("crypto");
const bcrypt = require("bcrypt");

exports.createAdmin = async (req, res) => {
  try {
    const { email, password, firstname = "", lastname = "" } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: "error",
        message: "Email and password are required",
      });
    }

    const trimmedEmail = email.trim().toLowerCase();

    const existing = await User.findOne({ email: trimmedEmail });
    if (existing) {
      return res.status(409).json({
        status: "error",
        message: "User with this email already exists",
      });
    }

    const serialNumber = await User.getNextSerialNumber();

    // const hashedPassword = await bcrypt.hash(password, 10);

    const referralCodeRaw = email + Date.now();
    const referralCode = crypto.createHash("sha256").update(referralCodeRaw).digest("hex").slice(0, 16);

    const now = new Date();
    const trialEnds = new Date(now);
    trialEnds.setDate(trialEnds.getDate() + 14); // optional for admin

    const admin = await User.create({
      email: trimmedEmail,
      password: password,
      firstname,
      lastname,
      serialNumber,
      role: "admin",
      isVerified: true,
      signupMethod: "email",
      isPremium: false,
      trialStart: now,
      trialEnd: trialEnds,
      referralCode,
    });

    return res.status(201).json({
      status: "success",
      message: "Admin created successfully",
      data: {
        _id: admin._id,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (err) {
    console.error("Error creating admin:", err);
    return res.status(500).json({
      status: "error",
      message: "Failed to create admin",
      error: err.message,
    });
  }
};
