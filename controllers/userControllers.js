const { OAuth2Client } = require("google-auth-library");
const appleSignin = require("apple-signin-auth");
const { createTokenforUser } = require("../services/authentication");
const User = require("../models/userModel");
const mongoose = require("mongoose");
const { getNextSerialNumber } = require("../utils/serialUtils");
const { generateUserQRCode } = require("../utils/qrUtils");
const crypto = require("crypto");
const { sendVerificationEmail } = require("../utils/emailUtils");
const googleClient = new OAuth2Client("401067515093-9j7faengj216m6uc9csubrmo3men1m7p.apps.googleusercontent.com");

const saveSignupData = async (req, res) => {
  try {
    const {
      email = "",
      phonenumber = "",
      password,
      firstname = "",
      lastname = "",
      verifyToken = ""
    } = req.body;

    // === PART 1: Handle Email Verification Token ===
    if (verifyToken) {
      const user = await User.findOne({ emailVerificationToken: verifyToken });

      if (!user) {
        return res.status(400).json({
          status: "error",
          message: "Invalid or expired verification token",
        });
      }

      user.isVerified = true;
      user.emailVerificationToken = undefined;

      if (!user.qrCode) {
        const { qrCode } = await generateUserQRCode(user.firstname || "user", user.serialNumber, {
          firstname: user.firstname,
          lastname: user.lastname,
          email: user.email,
          phonenumbers: user.phonenumbers,
          email: user.email,
          provider: "local"
        });

        user.qrCode = qrCode;
      }

      // ✅ UPDATED SCANNER LOGIC
      // const matchingUsers = await User.find({
      //   scannedMe: {
      //     $elemMatch: {
      //       $or: [
      //         { email: user.email },
      //         { phonenumber: user.phonenumbers?.[0] || "" }
      //       ]
      //     }
      //   }
      // });

      // ✅ UPDATED SCANNER LOGIC (fixed for email signup)
      let matchConditions = [];
      if (user.email) {
        matchConditions.push({ email: user.email });
      }

      console.log(user.email);

      if (user.phonenumbers?.[0]) {
        matchConditions.push({ phonenumber: user.phonenumbers[0] });
      }

      const matchingUsers = matchConditions.length > 0
        ? await User.find({
          scannedMe: {
            $elemMatch: {
              $or: matchConditions
            }
          }
        })
        : [];

      console.log(matchingUsers);


      for (const scanner of matchingUsers) {
        let updated = false;

        scanner.scannedMe = scanner.scannedMe.map(entry => {
          if (typeof entry === "object" && (
            (entry.email && entry.email === user.email) ||
            (entry.phonenumber && entry.phonenumber === user.phonenumbers?.[0])
          )) {
            updated = true;
            return user._id;
          }
          return entry;
        });

        if (updated) await scanner.save();

        if (!Array.isArray(user.iScanned)) user.iScanned = [];
        // if (!user.iScanned.includes(scanner._id)) {
        //   user.iScanned.push(scanner._id);
        // }

        if (!user.iScanned.some(entry => {
          if (typeof entry === "object" && entry._id) return entry._id.toString() === scanner._id.toString();
          return entry.toString() === scanner._id.toString();
        })) {
          user.iScanned.push({
            _id: scanner._id,
            firstname: scanner.firstname || "",
            lastname: scanner.lastname || "",
            email: scanner.email || "",
            phonenumbers: scanner.phonenumbers || [],
            profileImageURL: scanner.profileImageURL || "/images/defaultUserPic.png"
          });
        }


      }

      await user.save();


      return res.status(200).json({
        status: "success",
        message: "Email verified successfully. You can now log in.",
      });
    }

    // === PART 2: Initial Signup ===
    if (!password || (!email && !phonenumber)) {
      return res.status(400).json({
        status: "error",
        message: "Password and either email or phone number are required",
      });
    }

    // === Check Email Existence ===
    if (email && email.trim() !== "") {
      const emailExists = await User.findOne({ email: email.trim() });
      if (emailExists) {
        return res.status(409).json({
          status: "error",
          message: "User with this email already exists",
        });
      }
    }

    // === Check Phone Number Existence ===
    if (phonenumber && phonenumber.trim() !== "") {
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

    // === Generate Serial Number ===
    const serialNumber = await getNextSerialNumber();

    // === Build User Data ===
    const newUserData = {
      password,
      firstname,
      lastname,
      phonenumbers: phonenumber ? [phonenumber] : [],
      serialNumber,
      isVerified: false,
    };

    // If email signup: generate token + require verification
    if (email && email.trim() !== "") {
      newUserData.email = email.trim();
      newUserData.emailVerificationToken = crypto.randomBytes(32).toString("hex");
    } else {
      // If phone signup: immediately verified and generate QR code
      newUserData.isVerified = true;
      const { qrCode } = await generateUserQRCode(firstname || "user", serialNumber, {
        firstname,
        lastname,
        phonenumbers: newUserData.phonenumbers,
        provider: "local"
      });

      newUserData.qrCode = qrCode;
    }

    const newUser = await User.create(newUserData);

    if (newUser.isVerified) {
      // const matchingUsers = await User.find({
      //   scannedMe: {
      //     $elemMatch: {
      //       $or: [
      //         { email: newUser.email },
      //         { phonenumber: newUser.phonenumbers?.[0] || "" }
      //       ]
      //     }
      //   }
      // });

      let matchConditions = [];
      if (newUser.email) {
        matchConditions.push({ email: newUser.email });
      }
      if (newUser.phonenumbers?.[0]) {
        matchConditions.push({ phonenumber: newUser.phonenumbers[0] });
      }

      const matchingUsers = matchConditions.length > 0
        ? await User.find({
          scannedMe: {
            $elemMatch: {
              $or: matchConditions
            }
          }
        })
        : [];


      for (const scanner of matchingUsers) {
        let updated = false;

        scanner.scannedMe = scanner.scannedMe.map(entry => {
          if (typeof entry === "object" && (
            (entry.email && entry.email === newUser.email) ||
            (entry.phonenumber && entry.phonenumber === newUser.phonenumbers?.[0])
          )) {
            updated = true;
            return newUser._id;
          }
          return entry;
        });

        if (updated) await scanner.save();

        if (!Array.isArray(newUser.iScanned)) newUser.iScanned = [];
        // if (!newUser.iScanned.includes(scanner._id)) {
        //   newUser.iScanned.push(scanner._id);
        // }

        if (!user.iScanned.some(entry => {
          if (typeof entry === "object" && entry._id) return entry._id.toString() === scanner._id.toString();
          return entry.toString() === scanner._id.toString();
        })) {
          user.iScanned.push({
            _id: scanner._id,
            firstname: scanner.firstname || "",
            lastname: scanner.lastname || "",
            email: scanner.email || "",
            phonenumbers: scanner.phonenumbers || [],
            profileImageURL: scanner.profileImageURL || "/images/defaultUserPic.png"
          });
        }


      }

      await newUser.save();
    }

    // === Send Verification Email if email exists ===
    if (newUser.email && newUser.emailVerificationToken) {
      const verificationLink = `https://contacts-user-web.vercel.app/user-verification?verificationToken=${newUser.emailVerificationToken}`;
      await sendVerificationEmail(newUser.email, verificationLink);
    }

    return res.status(201).json({
      status: "success",
      message: email
        ? "Signup started. Please verify your email to activate your account."
        : "Signup completed successfully.",
      data: {
        _id: newUser._id,
        email: newUser.email || null,
        phonenumbers: newUser.phonenumbers,
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



const unifiedLogin = async (req, res) => {
  try {
    const { email = "", phonenumber = "", password = "", googleToken, appleToken } = req.body;

    // // === EMAIL or PHONENUMBER + PASSWORD ===
    // if ((email || phonenumber) && password && !googleToken && !appleToken) {
    //   try {
    //     const token = await User.matchPasswordAndGenerateToken({ email, phonenumber, password });
    //     return res.json({ status: "success", message: "Login successful", data: { token } });
    //   } catch (err) {
    //     return res.status(401).json({ status: "error", message: err.message || "Invalid credentials" });
    //   }
    // }

    if ((email || phonenumber) && password && !googleToken && !appleToken) {
      try {
        const user = await User.findOne({ $or: [{ email }, { phonenumbers: { $in: [phonenumber] } }] });

        if (!user) {
          return res.status(401).json({ status: "error", message: "User not found" });
        }

        if (email && !user.isVerified) {
          return res.status(403).json({ status: "error", message: "Please verify your email before logging in" });
        }

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

        const { email } = ticket.getPayload();
        let user = await User.findOne({ email });

        // if (!user) {
        //   user = await User.create({ email, firstname: firstName, lastname: lastName, provider: "google" });
        // }

        // const { qrCode } = await generateUserQRCode(firstname, serialNumber);


        // if (!user) {
        //   const serialNumber = await getNextSerialNumber();
        //   user = await User.create({
        //     email,
        //     firstname: ticket.getPayload().given_name || "Google",
        //     lastname: ticket.getPayload().family_name || "User",
        //     provider: "google",
        //     serialNumber,
        //     qrCode
        //   });
        // }

        if (!user) {
          const serialNumber = await getNextSerialNumber();
          const firstname = ticket.getPayload().given_name || "Google";
          const lastname = ticket.getPayload().family_name || "User";

          const { qrCode } = await generateUserQRCode(firstname, serialNumber, {
            firstname,
            lastname,
            email,
            provider: "google"
          });

          user = await User.create({
            email,
            firstname,
            lastname,
            provider: "google",
            serialNumber,
            qrCode
          });
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

        // if (!user) {
        //   user = await User.create({
        //     email: appleEmail,
        //     provider: "apple",
        //     firstname: appleUser.firstName || "Apple",
        //     lastname: appleUser.lastName || "User",
        //   });
        // }

        // if (!user) {
        //   const serialNumber = await getNextSerialNumber();
        //   user = await User.create({
        //     email: appleEmail,
        //     provider: "apple",
        //     firstname: appleUser.firstName || "Apple",
        //     lastname: appleUser.lastName || "User",
        //     serialNumber
        //   });
        // }

        if (!user) {
          const serialNumber = await getNextSerialNumber();
          const firstname = appleUser.firstName || "Apple";
          const lastname = appleUser.lastName || "User";

          const { qrCode } = await generateUserQRCode(firstname, serialNumber, {
            firstname,
            lastname,
            email: appleEmail,
            provider: "apple"
          });

          user = await User.create({
            email: appleEmail,
            provider: "apple",
            firstname,
            lastname,
            serialNumber,
            qrCode
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
  saveSignupData,
  unifiedLogin,
};
