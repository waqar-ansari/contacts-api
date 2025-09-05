const User = require("../../models/userModel");
const path = require("path");
const mongoose = require("mongoose");
const { PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { parsePhoneNumberFromString } = require("libphonenumber-js");
const s3 = require("../../utils/s3");
const { userInfo } = require("os");

// GET all users
const getAllUsers = async (req, res) => {
  try {
    console.log("Fetching all users");

    const users = await User.find({ role: "user" })
      .select("firstname lastname email phonenumbers planExpiresAt")
      .populate({
        path: "plan",
        select: "name",
      });

    const activeCount = await User.countDocuments({
      role: "user",
      isActive: true,
    });
    const inactiveCount = await User.countDocuments({
      role: "user",
      isActive: false,
    });

    res.status(200).json({
      status: "success",
      message: "Users retrieved successfully",
      count: users.length,
      activeCount,
      inactiveCount,
      data: users,
    });
  } catch (err) {
    console.error("Get Users Error:", err);
    res.status(500).json({ status: "error", message: "Server error" });
  }
};

// GET single user by ID
const getUser = async (req, res) => {
  try {
    console.log("Fetching user with ID:", req.params.id);

    const { id } = req.params;

    const user = await User.findOne({ _id: id, role: "user" })
      .populate({
        path: "plan",
        select: "name",
      })
      .select(
        "firstname lastname email role gender signupMethod isPremium isVerified referralCode creditBalance profileImageURL designation planExpiresAt createdAt userInfo phonenumbers instagram twitter linkedin facebook telegram"
      );

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    // Convert to plain object and transform _id to id
    const userData = user.toObject();
    userData.id = userData._id;
    delete userData._id;

    res.status(200).json({
      status: "success",
      message: "User retrieved successfully",
      data: userData,
    });
  } catch (err) {
    console.error("Get User Error:", err);
    res.status(500).json({ status: "error", message: "Server error" });
  }
};

const uploadImageToS3 = async (file) => {
  const ext = path.extname(file.originalname);
  const name = path.basename(file.originalname, ext);
  const fileName = `profileImages/${name}_${Date.now()}${ext}`;

  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: fileName,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  const command = new PutObjectCommand(params);
  await s3.send(command);

  return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
};

const deleteImageFromS3 = async (imageUrl) => {
  try {
    if (!imageUrl) return;

    // Extract the Key from the URL
    const urlParts = imageUrl.split(".amazonaws.com/");
    if (urlParts.length < 2) return; // not a valid S3 URL

    const fileKey = urlParts[1]; // profileImages/filename.jpg

    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: fileKey,
    };

    const command = new DeleteObjectCommand(params);
    await s3.send(command);

    console.log(`✅ Deleted from S3: ${fileKey}`);
  } catch (err) {
    console.error("Failed to delete from S3:", err);
  }
};

const editProfile = async (req, res) => {
  try {
    const { id } = req.params;
    console.log("Edit profile for user ID:", id);

    const userId = mongoose.Types.ObjectId.isValid(id) ? id : null;
    if (!userId) {
      return res
        .status(400)
        .json({ status: "error", message: "Invalid user ID" });
    }
    console.log(userId);

    const {
      firstname,
      lastname,
      email,
      linkedin,
      instagram,
      telegram,
      twitter,
      facebook,
      designation,
      helps = [],
      goals = "",
      categories = "",
      employeeCount = "",
      companyName = "",

      apiType = "web", // default to web if not provided
    } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ status: "error", message: "User not found" });
    }

    const keys = Object.keys(req.body);

    if (keys.includes("firstname")) user.firstname = firstname;
    if (keys.includes("lastname")) user.lastname = lastname;
    // if (keys.includes('email')) user.email = email;
    if (keys.includes("linkedin")) user.linkedin = linkedin;
    if (keys.includes("instagram")) user.instagram = instagram;
    if (keys.includes("telegram")) user.telegram = telegram;
    if (keys.includes("twitter")) user.twitter = twitter;
    if (keys.includes("facebook")) user.facebook = facebook;
    if (keys.includes("designation")) user.designation = designation;

    if (keys.includes("email") && email) {
      const trimmedEmail = email.trim().toLowerCase();

      // Case 1: signupMethod = email|google|linkedin → disallow
      if (["email", "google", "linkedin"].includes(user.signupMethod)) {
        return res.status(400).json({
          status: "error",
          message: "You cannot change email for this account.",
        });
      }

      // Case 2: signupMethod != email|google|linkedin (ex: phoneNumber) → check for duplicates
      const existingUser = await User.findOne({
        email: trimmedEmail,
        _id: { $ne: user._id },
      });
      if (existingUser) {
        return res.status(400).json({
          status: "error",
          message: "This email is already used.",
        });
      }

      user.email = trimmedEmail;
    }

    // =========================
    // 🔒 PHONE UPDATE CHECKS
    // =========================
    if (apiType === "mobile") {
      if (req.body.countryCode && req.body.phonenumber) {
        if (user.signupMethod === "phoneNumber") {
          return res.status(400).json({
            status: "error",
            message: "You cannot change phone number for this account.",
          });
        }

        const newNumberObj = {
          countryCode: String(req.body.countryCode).replace(/\D/g, ""),
          number: String(req.body.phonenumber).replace(/\D/g, ""),
        };

        // Check if this phone already exists
        const existingPhoneUser = await User.findOne({
          phonenumbers: { $elemMatch: newNumberObj },
          _id: { $ne: user._id },
        });

        if (existingPhoneUser) {
          return res.status(400).json({
            status: "error",
            message: "This phone number is already used.",
          });
        }

        user.phonenumbers = [newNumberObj];
      }
    } else if (apiType === "web") {
      if (req.body.phonenumber) {
        if (user.signupMethod === "phoneNumber") {
          return res.status(400).json({
            status: "error",
            message: "You cannot change phone number for this account.",
          });
        }

        let rawNumber = req.body.phonenumber.trim();
        if (!rawNumber.startsWith("+")) rawNumber = "+" + rawNumber;

        const phoneObj = parsePhoneNumberFromString(rawNumber);
        if (!phoneObj || !phoneObj.isValid()) {
          return res
            .status(400)
            .json({ status: "error", message: "Invalid phone number format" });
        }

        const newNumberObj = {
          countryCode: phoneObj.countryCallingCode,
          number: phoneObj.nationalNumber,
        };

        // Check if already exists
        const existingPhoneUser = await User.findOne({
          phonenumbers: { $elemMatch: newNumberObj },
          _id: { $ne: user._id },
        });

        if (existingPhoneUser) {
          return res.status(400).json({
            status: "error",
            message: "This phone number is already used.",
          });
        }

        user.phonenumbers = [newNumberObj];
      }
    }

    user.userInfo = user.userInfo || {}; // ensure object exists

    // Support both flat and bracketed keys from form-data
    // Parse helps array if it's a string (from form-data)
    if (keys.includes("helps")) {
      if (typeof helps === "string") {
        try {
          user.userInfo.helps = JSON.parse(helps);
        } catch (error) {
          console.error("Error parsing helps array:", error);
          user.userInfo.helps = [];
        }
      } else {
        user.userInfo.helps = helps;
      }
    }

    if (keys.includes("goals")) user.userInfo.goals = goals;
    if (keys.includes("categories")) user.userInfo.categories = categories;
    if (keys.includes("employeeCount"))
      user.userInfo.employeeCount = employeeCount;
    if (keys.includes("companyName")) user.userInfo.companyName = companyName;

    if (keys.includes("profileImage")) {
      // If client sends blank, remove the image
      if (!req.body.profileImage || req.body.profileImage.trim() === "") {
        await deleteImageFromS3(user.profileImageURL);
        user.profileImageURL = "";
      }
    }

    if (req.file) {
      // ✅ If user already has an image, delete the old one first
      if (user.profileImageURL) {
        await deleteImageFromS3(user.profileImageURL);
      }

      // ✅ Upload new image
      const profileImage = await uploadImageToS3(req.file);
      user.profileImageURL = profileImage;
    }
    // }

    await user.save();

    return res.status(200).json({
      status: "success",
      message: "Profile updated successfully",
      data: {
        id: user._id,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        role: user.role,
        signupMethod: user.signupMethod,
        isPremium: user.isPremium,
        isVerified: user.isVerified,
        referralCode: user.referralCode,
        creditBalance: user.creditBalance,
        profileImageURL: user.profileImageURL,
        designation: user.designation,
        planExpiresAt: user.planExpiresAt,
        createdAt: user.createdAt,
        userInfo: user.userInfo,
        phonenumbers: user.phonenumbers,
        instagram: user.instagram,
        twitter: user.twitter,
        linkedin: user.linkedin,
        facebook: user.facebook,
        telegram: user.telegram,
        qrcode: user.qrcode,
        provider: user.provider,
        gender: user.gender,
      },
    });
    // }
  } catch (error) {
    console.error("Edit Profile Error:", error);
    return res.status(500).json({ status: "error", message: "Server error" });
  }
};

module.exports = { getAllUsers, getUser, editProfile };
