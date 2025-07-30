const User = require("../models/userModel");
const mongoose = require("mongoose");

exports.checkEmailPhoneDuplicate = async (req, res) => {
  try {
    const { email, phonenumber, user_id } = req.body;

    if (!email && !phonenumber) {
      return res.status(400).json({
        status: "error",
        message: "Please provide email or phone number for checking.",
      });
    }

    const query = {
      $or: [],
    };

    const trimmedEmail = email?.trim().toLowerCase();
    let normalizedPhone = "";

    if (email) {
      query.$or.push({ email: trimmedEmail });
    }

    if (phonenumber) {
      normalizedPhone = phonenumber.replace(/^\+/, ""); // ✅ Remove plus sign
      query.$or.push({ phonenumbers: { $in: [normalizedPhone] } });
    }

    // ✅ Exclude current user (if editing)
    if (user_id && mongoose.Types.ObjectId.isValid(user_id)) {
      query._id = { $ne: user_id };
    }

    const existingUsers = await User.find(query, "email phonenumbers");

    let emailUsed = false;
    let phoneUsed = false;

    for (const user of existingUsers) {
      if (email && user.email?.toLowerCase() === trimmedEmail) {
        emailUsed = true;
      }

      if (phonenumber && user.phonenumbers.includes(normalizedPhone)) {
        phoneUsed = true;
      }
    }

    // ✅ Duplicate Error Messages
    if (emailUsed || phoneUsed) {
      let errorMessage = "";

      if (emailUsed && phoneUsed) {
        errorMessage = "Both email and phone number are already used by another user.";
      } else if (emailUsed) {
        errorMessage = "Email is already used by another user.";
      } else if (phoneUsed) {
        errorMessage = "Phone number is already used by another user.";
      }

      return res.status(400).json({
        status: "error",
        message: errorMessage,
      });
    }

    // ✅ Success Messages
    let successMessage = "";

    if (email && phonenumber) {
      successMessage = "Both email and phone number are available.";
    } else if (email) {
      successMessage = "Email is available.";
    } else if (phonenumber) {
      successMessage = "Phone number is available.";
    }

    return res.status(200).json({
      status: "success",
      message: successMessage,
    });

  } catch (error) {
    console.error("Duplicate check error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error during duplicate check.",
    });
  }
};
