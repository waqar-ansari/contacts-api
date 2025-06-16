const { OAuth2Client } = require("google-auth-library");
const appleSignin = require("apple-signin-auth");
const { createTokenforUser } = require("../services/authentication");
const User = require("../models/userModel");
const mongoose = require("mongoose");

const { generateOtp, sendEmailOtp } = require("../utils/otpUtils");

const googleClient = new OAuth2Client("401067515093-9j7faengj216m6uc9csubrmo3men1m7p.apps.googleusercontent.com");

// OTP Schema
const Otp = mongoose.model("Otp", new mongoose.Schema({
  email: String,
  phonenumber: String,
  otp: String,
  createdAt: { type: Date, default: Date.now, index: { expires: 300 } },
}));

// STEP 1: Request OTP
const requestOtp = async (req, res) => {
  try {
    let { email = "" } = req.body;

    if (!email) {
      return res.status(400).json({
        status: "error",
        message: "Email is required",
      });
    }

    // Build dynamic query
    const query = [];
    if (email) query.push({ email });

    const existingUser = await User.findOne({ $or: query });

    if (existingUser) {
      return res.status(409).json({
        status: "error",
        message: "User already registered",
      });
    }

    // Remove previous OTPs
    await Otp.deleteMany({ $or: [{ email }] });

    const otpCode = generateOtp(); // e.g. "123456"

    await Otp.create({ email, otp: otpCode });

    if (email) await sendEmailOtp(email, otpCode);

    return res.json({
      status: "success",
      message: "OTP sent successfully",
    });
  } catch (err) {
    console.error("OTP error:", err);
    return res.status(500).json({
      status: "error",
      message: "Failed to send OTP",
    });
  }
};

// STEP 2: Signup with OTP
const saveSignupData = async (req, res) => {
  try {
    const {
      email = "",
      phonenumber = "",
      password,
      firstname = "",
      lastname = "",
      otp = ""
    } = req.body;

    if (!password || (!email && !phonenumber)) {
      return res.status(400).json({
        status: "error",
        message: "Password and either email or phone number are required",
      });
    }

    // === EMAIL REGISTRATION ===
    if (email.trim()) {
      if (!otp.trim()) {
        return res.status(400).json({
          status: "error",
          message: "OTP is required for email registration",
        });
      }

      const otpMatch = await Otp.findOne({ email, otp });

      if (!otpMatch) {
        return res.status(400).json({
          status: "error",
          message: "Invalid or expired OTP",
        });
      }

      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return res.status(409).json({
          status: "error",
          message: "User with this email already exists",
        });
      }

      await Otp.deleteMany({ email }); // remove OTP once used
    }

    // === PHONE REGISTRATION ===
    if (phonenumber.trim()) {
      const phoneExists = await User.findOne({
        phonenumbers: { $in: [phonenumber] },
      });

      if (phoneExists) {
        return res.status(409).json({
          status: "error",
          message: "User with this phone number already exists",
        });
      }
    }

    const newUserData = {
      password,
      firstname,
      lastname,
      phonenumbers: phonenumber ? [phonenumber] : [],
    };

    if (email.trim()) {
      newUserData.email = email.trim();
    }

    const user = await User.create(newUserData);

    return res.status(201).json({
      status: "success",
      message: "User registered successfully",
      data: {
        _id: user._id,
        email: user.email || null,
        phonenumbers: user.phonenumbers,
      },
    });

  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({
      status: "error",
      message: "Signup failed",
      error: error.message,
    });
  }
};




// Unified Login
const unifiedLogin = async (req, res) => {
  try {
    const { email = "", phonenumber = "", password = "", googleToken, appleToken } = req.body;

    // === EMAIL or PHONENUMBER + PASSWORD ===
    if ((email || phonenumber) && password && !googleToken && !appleToken) {
      try {
        const token = await User.matchPasswordAndGenerateToken({ email, phonenumber, password });
        return res.json({ status: "success", message: "Login successful", data: { token } });
      } catch (err) {
        return res.status(401).json({ status: "error", message: err.message || "Invalid credentials" });
      }
    }

    // === GOOGLE LOGIN ===
    if (googleToken && !email && !password && !appleToken && !phonenumber) {
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken: googleToken,
          // audience: "308171825690-9tdne4lk5cof1rcmosck65i5iij46bvh.apps.googleusercontent.com",
          audience: "401067515093-9j7faengj216m6uc9csubrmo3men1m7p.apps.googleusercontent.com",
        });

        const { email, name } = ticket.getPayload();
        let user = await User.findOne({ email });

        if (!user) {
          user = await User.create({ email, firstname: name, provider: "google" });
        }

        const token = createTokenforUser(user);
        return res.json({ status: "success", message: "Google login successful", data: { token } });
      } catch (err) {
        console.log(err);

        return res.status(500).json({ status: "error", message: "Google login failed" });
      }
    }

    // === APPLE LOGIN ===
    if (appleToken && !email && !password && !googleToken && !phonenumber) {
      try {
        let id_token = appleToken;

        if (!id_token.includes(".")) {
          const decoded = Buffer.from(id_token, "base64").toString("utf8");
          if (!decoded.includes(".")) {
            return res.status(400).json({ message: "Invalid Apple token format" });
          }
          id_token = decoded;
        }

        const appleUser = await appleSignin.verifyIdToken(id_token, {
          audience: "com.contactmanagement",
          ignoreExpiration: true,
        });

        const appleEmail = appleUser.email || "noemail@apple.com";
        let user = await User.findOne({ email: appleEmail });

        if (!user) {
          user = await User.create({
            email: appleEmail,
            provider: "apple",
            firstname: appleUser.firstName || "Apple",
            lastname: appleUser.lastName || "User",
          });
        }

        const token = createTokenforUser(user);
        return res.json({ status: "success", message: "Apple login successful", data: { token } });
      } catch (err) {
        return res.status(500).json({ status: "error", message: "Apple login failed" });
      }
    }

    return res.status(400).json({ status: "error", message: "Invalid login request" });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Login failed" });
  }
};

module.exports = {
  requestOtp,
  saveSignupData,
  unifiedLogin,
};
