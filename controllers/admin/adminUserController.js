const User = require("../../models/userModel");
const Plan = require("../../models/planModel");
const path = require("path");
const mongoose = require("mongoose");
const { PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { parsePhoneNumberFromString } = require("libphonenumber-js");
const s3 = require("../../utils/s3");
const { checkAndHandlePlanExpiryBatch } = require("../../utils/planUtils");

// GET all users
const getAllUsers = async (req, res) => {
  try {
    console.log("Fetching all users");

    // Extract pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Extract search parameter
    const search = req.query.search || "";

    // Build search query
    let searchQuery = { role: "user" };
    if (search) {
      searchQuery.$or = [
        { firstname: { $regex: search, $options: "i" } },
        { lastname: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    // Get total count for pagination
    const totalUsers = await User.countDocuments(searchQuery);

    // Fetch users with pagination
    const users = await User.find(searchQuery)
      .select(
        "firstname lastname email phonenumbers planExpiresAt onFreeTrial plan creditBalance isPremium planActivatedAt"
      )
      .populate({
        path: "plan",
        select: "name price pricePeriod",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Check and handle plan expiry for all users before transformation
    const updatedUsers = await Promise.all(
      users.map(async (user) => {
        const updatedUser = await checkAndHandlePlanExpiryBatch(user);

        return updatedUser || user; // Return updated user or original if no changes
      })
    );

    // Transform users to include onFreeTrial inside plan object
    const transformedUsers = updatedUsers.map((user) => {
      const userObj = user.toObject();

      // If user has a plan, add onFreeTrial to it
      if (userObj.plan) {
        userObj.plan.onFreeTrial = userObj.onFreeTrial;
      } else {
        // If no plan, create a plan object with onFreeTrial
        userObj.plan = {
          name: null,
          onFreeTrial: userObj.onFreeTrial,
        };
      }

      // Remove onFreeTrial from the root level since it's now inside plan
      delete userObj.onFreeTrial;

      return userObj;
    });

    // Calculate pagination info
    const totalPages = Math.ceil(totalUsers / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.status(200).json({
      status: "success",
      message: "Users retrieved successfully",
      data: transformedUsers,
      pagination: {
        currentPage: page,
        totalPages,
        totalUsers,
        limit,
        hasNextPage,
        hasPrevPage,
      },
      count: transformedUsers.length,
    });
  } catch (err) {
    console.error("Get Users Error:", err);
    res.status(500).json({ status: "error", message: "Server error" });
  }
};

// GET all plans for dropdown
const getAllPlans = async (req, res) => {
  try {
    console.log("Fetching all plans for dropdown");

    const plans = await Plan.find({ isActive: true })
      .select("_id name price pricePeriod")
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: "success",
      message: "Plans retrieved successfully",
      data: plans,
    });
  } catch (err) {
    console.error("Get Plans Error:", err);
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
        "firstname lastname email role gender signupMethod isPremium isVerified referralCode creditBalance profileImageURL designation planExpiresAt planActivatedAt onFreeTrial createdAt userInfo phonenumbers instagram twitter linkedin facebook telegram"
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
      planId = "", // Add planId field
      planActivationDate = "", // Plan activation date
      planExpiryDate = "", // Plan expiry date
      onFreeTrial = false, // Free trial toggle

      apiType = "web", // default to web if not provided
    } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ status: "error", message: "User not found" });
    }

    const keys = Object.keys(req.body);
    console.log("Fields to update:", req.body);
    if (keys.includes("firstname")) user.firstname = firstname;
    if (keys.includes("lastname")) user.lastname = lastname;
    // if (keys.includes('email')) user.email = email;
    if (keys.includes("linkedin")) user.linkedin = linkedin;
    if (keys.includes("instagram")) user.instagram = instagram;
    if (keys.includes("telegram")) user.telegram = telegram;
    if (keys.includes("twitter")) user.twitter = twitter;
    if (keys.includes("facebook")) user.facebook = facebook;
    if (keys.includes("designation")) user.designation = designation;

    // =========================
    // 🔄 PLAN UPDATE
    // =========================
    if (
      keys.includes("planId") ||
      keys.includes("onFreeTrial") ||
      keys.includes("planActivationDate") ||
      keys.includes("planExpiryDate")
    ) {
      const currentDate = new Date();

      // Validate activation date for free trial
      if (
        keys.includes("planActivationDate") &&
        planActivationDate &&
        keys.includes("onFreeTrial") &&
        onFreeTrial
      ) {
        const activationDate = new Date(planActivationDate);

        // Check if activation date is in the future
        if (activationDate > currentDate) {
          return res.status(400).json({
            status: "error",
            message: "Activation date cannot be greater than the current date.",
          });
        }

        const expiryDate = new Date(
          activationDate.getTime() + 14 * 24 * 60 * 60 * 1000
        );

        if (expiryDate < currentDate) {
          return res.status(400).json({
            status: "error",
            message:
              "Activation date cannot be set such that the 14-day free trial would already be expired.",
          });
        }
      }

      // Validate expiry date when not on free trial
      if (
        keys.includes("planExpiryDate") &&
        planExpiryDate &&
        (!keys.includes("onFreeTrial") || !onFreeTrial)
      ) {
        const expiryDate = new Date(planExpiryDate);

        if (expiryDate <= currentDate) {
          return res.status(400).json({
            status: "error",
            message: "Plan expiry date must be greater than the current date.",
          });
        }
      }

      // Additional validations for non-free trial mode
      if (!keys.includes("onFreeTrial") || !onFreeTrial) {
        // Validate activation date cannot be greater than current date
        if (keys.includes("planActivationDate") && planActivationDate) {
          const activationDate = new Date(planActivationDate);

          if (activationDate > currentDate) {
            return res.status(400).json({
              status: "error",
              message:
                "Plan activation date cannot be greater than the current date.",
            });
          }
        }

        // Validate activation and expiry date relationship
        if (
          keys.includes("planActivationDate") &&
          keys.includes("planExpiryDate") &&
          planActivationDate &&
          planExpiryDate
        ) {
          const activationDate = new Date(planActivationDate);
          const expiryDate = new Date(planExpiryDate);

          if (activationDate >= expiryDate) {
            return res.status(400).json({
              status: "error",
              message:
                "Plan activation date must be earlier than the expiry date.",
            });
          }
        }

        // Validate expiry date against existing activation date
        if (
          keys.includes("planExpiryDate") &&
          planExpiryDate &&
          !keys.includes("planActivationDate")
        ) {
          const expiryDate = new Date(planExpiryDate);
          const existingActivationDate = user.planActivatedAt;

          if (existingActivationDate && expiryDate <= existingActivationDate) {
            return res.status(400).json({
              status: "error",
              message:
                "Plan expiry date must be later than the current activation date.",
            });
          }
        }

        // Validate activation date against existing expiry date
        if (
          keys.includes("planActivationDate") &&
          planActivationDate &&
          !keys.includes("planExpiryDate")
        ) {
          const activationDate = new Date(planActivationDate);
          const existingExpiryDate = user.planExpiresAt;

          if (existingExpiryDate && activationDate >= existingExpiryDate) {
            return res.status(400).json({
              status: "error",
              message:
                "Plan activation date must be earlier than the current expiry date.",
            });
          }
        }
      }

      // Handle free trial toggle
      if (keys.includes("onFreeTrial")) {
        user.onFreeTrial = onFreeTrial;

        if (onFreeTrial) {
          // If free trial is enabled, allow custom activation date but validate expiry
          let activationDate;

          if (keys.includes("planActivationDate") && planActivationDate) {
            activationDate = new Date(planActivationDate);
          } else {
            activationDate = user.planActivatedAt || new Date();
          }

          user.planActivatedAt = activationDate;
          user.planExpiresAt = new Date(
            activationDate.getTime() + 14 * 24 * 60 * 60 * 1000
          ); // 14 days from activation
          user.isPremium = false; // Free trial users are not premium
        } else {
          // If free trial is disabled, handle plan dates normally
          if (keys.includes("planActivationDate") && planActivationDate) {
            user.planActivatedAt = new Date(planActivationDate);
          }
          if (keys.includes("planExpiryDate") && planExpiryDate) {
            user.planExpiresAt = new Date(planExpiryDate);
          }
        }
      }

      // Handle plan selection
      if (keys.includes("planId")) {
        if (planId === "" || planId === "null" || planId === null) {
          // Remove plan (set to null)
          user.plan = null;
          user.planExpiresAt = null;
          user.planActivatedAt = null;
          user.isPremium = false;
          user.onFreeTrial = false;
        } else {
          // Validate plan exists
            const planExists = await Plan.findById(planId);
            if (!planExists) {
            return res.status(400).json({
              status: "error",
              message: "Invalid plan selected",
            });
            }

            if (!planExists.isActive) {
            return res.status(400).json({
              status: "error",
              message: "Selected plan is not active",
            });
            }

          user.plan = planId;

          // Check if this is a starter plan - if so, ignore all date/trial settings
          const isStarterPlan = planExists.name
            .toLowerCase()
            .includes("starter");

          if (isStarterPlan) {
            // For starter plan: hardcode settings and ignore frontend values
            user.onFreeTrial = false;
            user.isPremium = true;
            user.planActivatedAt = null; // Set to current date
            user.planExpiresAt = null; // 1 year from now
          } else {
            // Handle dates based on free trial status for non-starter plans
            if (
              user.onFreeTrial ||
              (keys.includes("onFreeTrial") && onFreeTrial)
            ) {
              user.isPremium = false;

              // Set activation date (allow custom date for free trial)
              if (keys.includes("planActivationDate") && planActivationDate) {
                user.planActivatedAt = new Date(planActivationDate);
              } else if (!user.planActivatedAt) {
                user.planActivatedAt = new Date();
              }

              // Always set expiry to 14 days from activation for free trial
              user.planExpiresAt = new Date(
                user.planActivatedAt.getTime() + 14 * 24 * 60 * 60 * 1000
              );
            } else {
              user.isPremium = true;

              // Use provided dates or set defaults for paid plans
              if (keys.includes("planActivationDate") && planActivationDate) {
                user.planActivatedAt = new Date(planActivationDate);
              } else if (!user.planActivatedAt) {
                user.planActivatedAt = new Date(); // Set to now if not provided
              }

              if (keys.includes("planExpiryDate") && planExpiryDate) {
                user.planExpiresAt = new Date(planExpiryDate);
              } else if (!user.planExpiresAt) {
                // Set plan expiry to 1 year from activation date for admin assignments
                const activationDate = user.planActivatedAt || new Date();
                user.planExpiresAt = new Date(
                  activationDate.getTime() + 365 * 24 * 60 * 60 * 1000
                );
              }
            }
          }
        }
      }

      // Handle manual date updates (but not for starter plans)
      if (user.plan) {
        const currentPlan = await Plan.findById(user.plan);
        const isStarterPlan = currentPlan?.name
          ?.toLowerCase()
          .includes("starter");

        if (!isStarterPlan) {
          if (
            !user.onFreeTrial &&
            !(keys.includes("onFreeTrial") && onFreeTrial)
          ) {
            if (keys.includes("planActivationDate") && planActivationDate) {
              user.planActivatedAt = new Date(planActivationDate);
            }
            if (keys.includes("planExpiryDate") && planExpiryDate) {
              user.planExpiresAt = new Date(planExpiryDate);
            }
          } else if (
            user.onFreeTrial ||
            (keys.includes("onFreeTrial") && onFreeTrial)
          ) {
            // For free trial, only allow activation date updates, expiry is always calculated
            if (keys.includes("planActivationDate") && planActivationDate) {
              user.planActivatedAt = new Date(planActivationDate);
              user.planExpiresAt = new Date(
                user.planActivatedAt.getTime() + 14 * 24 * 60 * 60 * 1000
              );
            }
          }
        }
      }
    }

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

    // Populate the plan information for the response
    await user.populate("plan", "name price pricePeriod");

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
        planActivatedAt: user.planActivatedAt,
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
        onFreeTrial: user.onFreeTrial,
        plan: user.plan, // Include plan information
      },
    });
    // }
  } catch (error) {
    console.error("Edit Profile Error:", error);
    return res.status(500).json({ status: "error", message: "Server error" });
  }
};

// GET users count excluding superadmin
const getUsersCount = async (req, res) => {
  try {
    // Count users where role is not 'superadmin'
    const totalUsers = await User.countDocuments({
      role: { $ne: "superadmin" },
    });

    return res.status(200).json({
      status: "success",
      message: "Users count retrieved successfully",
      data: { totalUsers },
    });
  } catch (err) {
    console.error("Get Users Count Error:", err);
    return res.status(500).json({ status: "error", message: "Server error" });
  }
};

module.exports = {
  getAllUsers,
  getUser,
  editProfile,
  getAllPlans,
  getUsersCount,
};
