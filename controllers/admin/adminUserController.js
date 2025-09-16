const User = require("../../models/userModel");
const Plan = require("../../models/planModel");
const path = require("path");
const mongoose = require("mongoose");
const { PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { parsePhoneNumberFromString } = require("libphonenumber-js");
const s3 = require("../../utils/s3");
const { checkAndHandlePlanExpiryBatch } = require("../../utils/planUtils");
const {
  getOrCreateStripeCustomer,
  getStripeCreditBalance,
  createStripeSubscription,
  cancelStripeSubscription,
  updateStripeSubscriptionPrice,
} = require("../../utils/stripeUtils");

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
        "firstname lastname email phonenumbers planExpiresAt onFreeTrial plan isPremium planActivatedAt"
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
        "firstname lastname email role gender signupMethod isPremium isVerified referralCode profileImageURL designation planExpiresAt planActivatedAt onFreeTrial createdAt userInfo phonenumbers instagram twitter linkedin facebook telegram"
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
      onFreeTrial = false, // Free trial toggle for Stripe subscriptions
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
    // 🔄 PLAN UPDATE - STRIPE INTEGRATED
    // =========================
    if (keys.includes("planId")) {
      try {
        if (planId === "" || planId === "null" || planId === null) {
          // Remove plan - cancel Stripe subscription
          if (user.stripeSubscriptionId) {
            await cancelStripeSubscription(user.stripeSubscriptionId);
          }

          // Set to Starter plan
          const starterPlan = await Plan.findOne({
            name: "Starter",
            isActive: true,
          });
          if (starterPlan) {
            user.plan = starterPlan._id;
            user.isPremium = false;
            user.onFreeTrial = false;
            // Clear Stripe subscription data
            user.stripeSubscriptionId = null;
            user.stripeSubscriptionStatus = null;
            user.stripeCurrentPeriodStart = null;
            user.stripeCurrentPeriodEnd = null;
            user.stripeCancelAtPeriodEnd = false;
          }
        } else {
          // Validate plan exists
          const selectedPlan = await Plan.findById(planId);
          if (!selectedPlan) {
            return res.status(400).json({
              status: "error",
              message: "Invalid plan selected",
            });
          }

          if (!selectedPlan.isActive) {
            return res.status(400).json({
              status: "error",
              message: "Selected plan is not active",
            });
          }

          // Check if this is a starter plan
          const isStarterPlan = selectedPlan.name
            .toLowerCase()
            .includes("starter");

          if (isStarterPlan) {
            // Cancel any existing subscription for starter plan
            if (user.stripeSubscriptionId) {
              await cancelStripeSubscription(user.stripeSubscriptionId);
            }

            user.plan = selectedPlan._id;
            user.isPremium = false;
            user.onFreeTrial = false;
            // Clear Stripe subscription data
            user.stripeSubscriptionId = null;
            user.stripeSubscriptionStatus = null;
            user.stripeCurrentPeriodStart = null;
            user.stripeCurrentPeriodEnd = null;
            user.stripeCancelAtPeriodEnd = false;
          } else {
            // For premium plans, create/update Stripe subscription
            const stripeCustomer = await getOrCreateStripeCustomer(user);

            if (!selectedPlan.stripePriceId) {
              return res.status(400).json({
                status: "error",
                message: "Selected plan is not configured with Stripe pricing",
              });
            }

            let subscription;

            if (user.stripeSubscriptionId) {
              // Update existing subscription
              subscription = await updateStripeSubscriptionPrice(
                user.stripeSubscriptionId,
                selectedPlan.stripePriceId
              );
            } else {
              // Create new subscription
              const hasTrialOption =
                keys.includes("onFreeTrial") && onFreeTrial;
              subscription = await createStripeSubscription(
                stripeCustomer.id,
                selectedPlan.stripePriceId,
                hasTrialOption ? 14 : 0 // 14 day trial if requested
              );
            }

            // Update user with Stripe subscription data
            user.plan = selectedPlan._id;
            user.isPremium =
              subscription.status === "active" ||
              subscription.status === "trialing";
            user.onFreeTrial = subscription.status === "trialing";
            user.stripeSubscriptionId = subscription.id;
            user.stripeSubscriptionStatus = subscription.status;
            user.stripeCurrentPeriodStart = new Date(
              subscription.current_period_start * 1000
            );
            user.stripeCurrentPeriodEnd = new Date(
              subscription.current_period_end * 1000
            );
            user.stripeCancelAtPeriodEnd = subscription.cancel_at_period_end;

            // Remove backend date management - Stripe handles this
            user.planActivatedAt = user.stripeCurrentPeriodStart;
            user.planExpiresAt = user.stripeCurrentPeriodEnd;
          }
        }

        console.log(
          `Admin updated plan for user ${user._id} to ${
            selectedPlan?.name || "Starter"
          } via Stripe`
        );
      } catch (stripeError) {
        console.error("Stripe integration error:", stripeError);
        return res.status(500).json({
          status: "error",
          message:
            "Failed to update subscription in Stripe: " + stripeError.message,
        });
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

    // Get Stripe credit balance
    const stripeCreditBalance = await getStripeCreditBalance(user._id);

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
        creditBalance: stripeCreditBalance,
        profileImageURL: user.profileImageURL,
        designation: user.designation,
        // Plan dates from Stripe subscription
        planExpiresAt: user.stripeCurrentPeriodEnd || user.planExpiresAt,
        planActivatedAt: user.stripeCurrentPeriodStart || user.planActivatedAt,
        subscriptionStatus: user.stripeSubscriptionStatus,
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
