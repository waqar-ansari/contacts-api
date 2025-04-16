
const User = require("../models/userModel");
const { OAuth2Client } = require("google-auth-library");
const appleSignin = require("apple-signin-auth");
const { createTokenforUser } = require("../services/authentication");

const googleClient = new OAuth2Client("308171825690-9tdne4lk5cof1rcmosck65i5iij46bvh.apps.googleusercontent.com");

const saveSignupData = async (req, res) => {
  try {
    const { email, password, firstname, lastname } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: "error",
        message: "email and password is required"
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ status: "error", message: "User already registered" });
    }

    const newUser = await User.create({ email, password, firstname, lastname });

    if (!newUser) {
      return res.status(500).json({ status: "error", message: "User registration failed" });
    }

    return res.status(201).json({ status: "success", message: "User registered successfully" });

  } catch (error) {
    return res.status(500).json({ status: "error", message: "Something went wrong during registration"});
  }
};

const unifiedLogin = async (req, res) => {
  try {
    const { email, password, googleToken, appleToken } = req.body;

    // 🔐 Email & Password Login
    if (email && password && !googleToken && !appleToken) {
      try {
        const token = await User.matchPasswordAndGenerateToken(email, password);
        return res.json({
          status: "success",
          message: "Login successful",
          data: { token }
        });
      } catch (error) {
        return res.status(401).json({
          status: "error",
          message: "Invalid email or password",
        });
      }
    }

    // 🔐 Google Login
    if (googleToken && !email && !password && !appleToken) {
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken: googleToken,
          audience: "308171825690-9tdne4lk5cof1rcmosck65i5iij46bvh.apps.googleusercontent.com",
        });

        const { email, name } = ticket.getPayload();

        let user = await User.findOne({ email });
        if (!user) {
          user = await User.create({ email, firstname: name, provider: "google" });
        }

        const token = createTokenforUser(user);
        return res.json({ status: "success", message: "Google login successful", data: { token } });

      } catch (error) {
        return res.status(500).json({ status: "error", message: "Google login failed" });
      }
    }

    // 🔐 Apple Login
    if (appleToken && !email && !password && !googleToken) {
      try {
        let id_token = appleToken;

        if (!id_token.includes(".")) {
          const decoded = Buffer.from(id_token, 'base64').toString('utf8');
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

      } catch (error) {
        return res.status(500).json({ status: "error", message: "Apple login failed" });
      }
    }

    return res.status(400).json({ status: "error", message: "Invalid login request" });

  } catch (err) {
    return res.status(500).json({ status: "error", message: "Login failed" });
  }
};

module.exports = {
  saveSignupData,
  unifiedLogin,
};
