const User = require("../models/userModel");
const Contact = require("../models/contactModel");
const { checkForAuthentication } = require("../middlewares/authentication");
const { Schema } = require("mongoose");

const saveSignupData = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        status: "error",
        message: "User already registered",
      });
    }

    // Create new user
    await User.create({ email, password });

    return res.status(201).json({
      status: "success",
      message: "User registered successfully",
    });
  } catch (error) {
    console.error("Signup Error:", error);
    return res.status(500).json({
      status: "error",
      message: "Something went wrong during registration",
    });
  }
};

const processLoginData = async (req, res) => {
  try {
    const { email, password } = req.body;
    const token = await User.matchPasswordAndGenerateToken(email, password);
    return res.json({
      status: "success",
      message: "Login successful.",
      data: { token },
    });
  } catch (error) {

    return res.status(401).json({
      status: "error",
      message: "Invalid email or password",
    });
  }
};

module.exports = { saveSignupData, processLoginData };