const User = require("../models/userModel");
const { OAuth2Client } = require("google-auth-library");
const appleSignin = require("apple-signin-auth");
const { createTokenforUser } = require("../services/authentication");

const googleClient = new OAuth2Client("308171825690-9tdne4lk5cof1rcmosck65i5iij46bvh.apps.googleusercontent.com");

const saveSignupData = async (req, res) => {
  try {
    const { email, password, firstname, lastname } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ status: "error", message: "User already registered" });
    }
    await User.create({ email, password, firstname, lastname });
    return res.status(201).json({ status: "success", message: "User registered successfully" });
  } catch (error) {
    console.error("Signup Error:", error);
    return res.status(500).json({ status: "error", message: "Something went wrong during registration" });
  }
};

const processLoginData = async (req, res) => {
  try {
    const { email, password } = req.body;
    const token = await User.matchPasswordAndGenerateToken(email, password);
    return res.json({ status: "success", message: "Login successful", data: { token } });
  } catch (error) {
    return res.status(401).json({ status: "error", message: "Invalid email or password" });
  }
};

const googleAuth = async (req, res) => {
  try {
    const { idToken } = req.body;
    const ticket = await googleClient.verifyIdToken({
      idToken, audience: "308171825690-9tdne4lk5cof1rcmosck65i5iij46bvh.apps.googleusercontent.com",
      maxExpiry: 3600, // in seconds (optional)
    });
    const { email, name } = ticket.getPayload();

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({ email, firstname: name, provider: "google" });
    }

    const token = createTokenforUser(user);
    return res.json({ status: "success", message: "Google login successful", data: { token } });
  } catch (error) {
    console.error("Google login error:", error);
    return res.status(400).json({ status: "error", message: "Google login failed" });
  }
};

const appleAuth = async (req, res) => {
  try {
    let { id_token } = req.body;

    if (!id_token) {
      return res.status(400).json({ message: "ID token is required" });
    }

    // 🔐 If it's base64 (no dot), decode to get actual JWT
    if (!id_token.includes(".")) {
      try {
        const decoded = Buffer.from(id_token, 'base64').toString('utf8');
        if (!decoded.includes(".")) {
          return res.status(400).json({ message: "Decoded token is not a valid JWT" });
        }
        id_token = decoded;
        console.log(decoded);
        
      } catch (decodeErr) {
        return res.status(400).json({ message: "Invalid base64 encoding" });
      }
    }

    // ✅ Verify Apple ID token
    const appleUser = await appleSignin.verifyIdToken(id_token, {
      audience: "com.contactmanagement", // ✅ MUST match Apple Service ID
      ignoreExpiration: true,
    });

    // ✅ Extract or fallback email
    const email = appleUser.email || "noemail@apple.com";
    const existingUser = await User.findOne({ email });

    let user;
    if (existingUser) {
      user = existingUser;
    } else {
      user = await User.create({
        email,
        provider: "apple",
        firstname: appleUser.firstName || "Apple",
        lastname: appleUser.lastName || "User",
      });
    }

    const token = createTokenforUser(user);
    return res.json({ status: "success", message: "Apple login successful", data: { token } });

  } catch (err) {
    console.error("Apple login error:", err);
    res.status(500).json({ message: "Apple login failed", error: err.message });
  }
};


module.exports = {
  saveSignupData,
  processLoginData,
  googleAuth,
  appleAuth,
};
