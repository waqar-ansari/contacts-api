const { OAuth2Client } = require("google-auth-library");
const appleSignin = require("apple-signin-auth");
const { createTokenforUser } = require("../services/authentication");
const User = require("../models/userModel");
const { getNextSerialNumber } = require("../utils/serialUtils");
// const { generateUserQRCode } = require("../utils/qrUtils");
const crypto = require("crypto");
const { sendVerificationEmail } = require("../utils/emailUtils");
const {
  getOrCreateStripeCustomer,
  addStripeCredits,
  hasUserMadeFirstPurchase,
} = require("../utils/stripeUtils");
const googleClient = new OAuth2Client(
  "401067515093-9j7faengj216m6uc9csubrmo3men1m7p.apps.googleusercontent.com"
);
const sendWhatsAppOtp = require("../utils/sendWhatsAppOtp");
require("dotenv").config();
const { google } = require("googleapis");
const querystring = require("querystring");
const axios = require("axios");
const ReferralLog = require("../models/referralLogModel");
const { normalizePhone } = require("../utils/phoneUtils");
const Plan = require("../models/planModel");
const { setupInitialPlan } = require("../utils/planUtils");
const BlacklistedToken = require("../models/blacklistedTokenModel");
const jwt = require("jsonwebtoken");
const FRONTEND_URL = process.env.FRONTEND_URL || "https://demo.contacts.management";


const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_LOGIN_URI // e.g. https://yourapi.com/auth/google/callback
);

// Requires: User and ReferralLog models in scope.
// Put this near top of your controller file:
async function addOrUpdateReferral(referrerId, referredUser) {
  if (!referrerId || !referredUser || !referredUser._id) return null;

  // Fetch fresh referrer doc
  const referrer = await User.findById(referrerId);
  if (!referrer) return null;

  // Normalize phone objects from referredUser
  const phoneObjs = Array.isArray(referredUser.phonenumbers)
    ? referredUser.phonenumbers.map((p) => ({
        countryCode: (p.countryCode || "").toString().replace(/^\+/, ""),
        number: (p.number || "").toString().replace(/^\+/, ""),
      }))
    : [];

  const referredIdStr = referredUser._id.toString();

  // Find existing entry index (works if myReferrals contains objects or just ids)
  const index = (referrer.myReferrals || []).findIndex((item) => {
    if (!item) return false;
    if (typeof item === "object" && item._id)
      return item._id.toString() === referredIdStr;
    // if stored as raw id string
    try {
      return item.toString() === referredIdStr;
    } catch (e) {
      return false;
    }
  });

  let now = new Date();
  let needSaveReferrer = false;
  console.log("referrer index is", index);
  if (index !== -1) {
    // Update missing fields on existing entry
    const entry = referrer.myReferrals[index];
    if (!entry.firstname && referredUser.firstname) {
      entry.firstname = referredUser.firstname;
      needSaveReferrer = true;
    }
    if (!entry.lastname && referredUser.lastname) {
      entry.lastname = referredUser.lastname;
      needSaveReferrer = true;
    }
    if ((!entry.email || entry.email === "") && referredUser.email) {
      entry.email = referredUser.email;
      needSaveReferrer = true;
    }

    if (
      (!Array.isArray(entry.phonenumbers) || entry.phonenumbers.length === 0) &&
      phoneObjs.length
    ) {
      entry.phonenumbers = phoneObjs;
      needSaveReferrer = true;
    }
    if (!entry.signupDate && referredUser.createdAt) {
      entry.signupDate = referredUser.createdAt;
      needSaveReferrer = true;
    }

    // markModified if subdoc changed
    if (needSaveReferrer) referrer.markModified("myReferrals");
  } else {
    // Push new consistent object
    const newEntry = {
      _id: referredUser._id,
      firstname: referredUser.firstname || "",
      lastname: referredUser.lastname || "",
      email: referredUser.email || "",
      phonenumbers: phoneObjs,
      signupDate: referredUser.createdAt || now,
    };
    console.log("new referral entry is", newEntry);
    referrer.myReferrals = referrer.myReferrals || [];
    referrer.myReferrals.push(newEntry);
    needSaveReferrer = true;
  }

  // Save referrer if any changes were made to myReferrals
  if (needSaveReferrer) {
    await referrer.save();
  }

  // Create ReferralLog if not exists (by email or phone)
  try {
    const orQueries = [];
    if (referredUser.email) orQueries.push({ email: referredUser.email });
    if (phoneObjs.length) {
      // use elemMatch to find same phone
      orQueries.push({
        phonenumbers: {
          $elemMatch: {
            countryCode: phoneObjs[0].countryCode,
            number: phoneObjs[0].number,
          },
        },
      });
    }
    if (orQueries.length) {
      const existingLog = await ReferralLog.findOne({ $or: orQueries });
      if (!existingLog) {
        const log = {
          referredBy: referrer._id,
          referredUserId: referredUser._id,
          signupDate: referredUser.createdAt || now,
        };
        if (referredUser.email) log.email = referredUser.email;
        if (phoneObjs.length) log.phonenumbers = phoneObjs;
        await ReferralLog.create(log);
      }
    }
  } catch (err) {
    console.error("ReferralLog create error:", err.message);
  }

  return true;
}

const signupWithEmail = async (req, res) => {
  try {
    const {
      email = "",
      password,
      firstname = "",
      lastname = "",
      verifyToken = "",
    } = req.body;

    const referralCodeParam = req.body.referralCode || req.query.ref || "";
    // const tenantId = req.query.tenantId || req.body.tenantId || "";

    // === PART 1: Email Verification Flow ===
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

      if (!user.signupMethod) {
        user.signupMethod = "email";
      }

      // Setup initial plan after email verification (skip for superadmin)
      let planData = null;
      if (user.role !== "superadmin") {
        planData = await setupInitialPlan(user, user.stripe_test_mode || false);
        console.log(
          "set up initial plan for user during sign up after verification:",
          planData
        );
        if (user.referredBy) {
          // Add $10 referral credits to the current user's cache (will be applied to Stripe on first purchase)
          try {
            // Update cache_credits instead of adding directly to Stripe
            user.cache_credits = (user.cache_credits || 0) + 10;
            console.log(
              `Added $10 welcome credit to user cache for user ${user._id}`
            );
          } catch (error) {
            console.error("Error adding welcome credit to user cache:", error);
          }

          // Add $10 referral credits to the referring user's cache if exists
          try {
            const referringUser = await User.findById(user.referredBy);
            if (referringUser) {
              // Check if referring user has made their first purchase
              let hasFirstPurchase = false;
              if (referringUser.stripeCustomerId) {
                hasFirstPurchase = await hasUserMadeFirstPurchase(
                  referringUser.stripeCustomerId,
                  referringUser.stripe_test_mode || false
                );
              }

              if (hasFirstPurchase) {
                // Add directly to Stripe customer account
                const referrerCustomer = await getOrCreateStripeCustomer(
                  referringUser,
                  referringUser.stripe_test_mode || false
                );
                await addStripeCredits(
                  referrerCustomer.id,
                  1000, // $10 in cents
                  `Referral bonus - ${
                    user.firstname || "User"
                  } verified their email`,
                  referringUser.stripe_test_mode || false
                );
                console.log(
                  `Added $10 referral credit directly to Stripe for referring user ${user.referredBy}`
                );
              } else {
                // Add to cache_credits
                referringUser.cache_credits =
                  (referringUser.cache_credits || 0) + 10;
                await referringUser.save();
                console.log(
                  `Added $10 referral credit to referring user cache ${user.referredBy}`
                );
              }
            }
          } catch (error) {
            console.error(
              "Error adding referral credits to referring user:",
              error
            );
          }
        }
      }

      // Activate user after email verification
      user.isActive = true;

      // if (!user.qrCode) {
      //   // const { qrCode } = await generateUserQRCode(user.firstname || "user", user.serialNumber, {
      //   //   firstname: user.firstname,
      //   //   lastname: user.lastname,
      //   //   email: user.emailaddresses,
      //   //   phonenumbers: user.phonenumbers,
      //   //   provider: "local"
      //   // });
      //   // user.qrCode = qrCode;
      //   let userDetails = user.toObject();

      //   // Remove sensitive fields
      //   delete userDetails.password;
      //   delete userDetails.emailVerificationToken;
      //   delete userDetails.resetPasswordToken;
      //   delete userDetails.resetPasswordExpires;

      //   // Create QR code with full (safe) details
      //   const { qrCode } = await generateUserQRCode(
      //     user.firstname || "user",
      //     user.serialNumber,
      //     userDetails
      //   );

      //   user.qrCode = qrCode;
      // }

      // ✅ Optional: Update scannedMe for other users
      let matchConditions = [];
      if (user.email) matchConditions.push({ email: user.email });
      // if (user.phonenumbers?.[0]) matchConditions.push({ phonenumber: user.phonenumbers[0] });
      // if (user.phonenumbers?.[0]) {
      //   matchConditions.push({
      //     phonenumbers: {
      //       $elemMatch: {
      //         countryCode: user.phonenumbers[0].countryCode,
      //         number: user.phonenumbers[0].number,
      //       },
      //     },
      //   });
      // }

      if (user.phonenumbers && user.phonenumbers.length > 0) {
        const phone = user.phonenumbers[0];
        if (phone.countryCode && phone.number) {
          matchConditions.push({
            phonenumbers: {
              $elemMatch: {
                countryCode: phone.countryCode,
                number: phone.number,
              },
            },
          });
        }
      }

      const matchingUsers =
        matchConditions.length > 0
          ? await User.find({
              scannedMe: {
                $elemMatch: {
                  $or: matchConditions,
                },
              },
            })
          : [];

      for (const scanner of matchingUsers) {
        let updated = false;
        scanner.scannedMe = scanner.scannedMe.map((entry) => {
          if (
            typeof entry === "object" &&
            ((entry.email && entry.email === user.email) ||
              // (entry.phonenumber && entry.phonenumber === user.phonenumbers?.[0])
              // (entry.phonenumber &&
              //   entry.phonenumber === user.phonenumbers[0].countryCode + user.phonenumbers[0].number)
              (entry.phonenumber &&
                user.phonenumbers &&
                user.phonenumbers.length > 0 &&
                user.phonenumbers[0].countryCode &&
                user.phonenumbers[0].number &&
                entry.phonenumber ===
                  user.phonenumbers[0].countryCode +
                    user.phonenumbers[0].number))
          ) {
            updated = true;
            return user._id;
          }
          return entry;
        });

        if (updated) await scanner.save();

        if (!Array.isArray(user.iScanned)) user.iScanned = [];

        if (
          !user.iScanned.some((entry) => {
            if (typeof entry === "object" && entry._id)
              return entry._id.toString() === scanner._id.toString();
            return entry.toString() === scanner._id.toString();
          })
        ) {
          user.iScanned.push({
            _id: scanner._id,
            firstname: scanner.firstname || "",
            lastname: scanner.lastname || "",
            email: scanner.email || "",
            phonenumbers: scanner.phonenumbers || [],
            profileImageURL: scanner.profileImageURL || "",
          });
        }
      }

      await user.save();

      const token = createTokenforUser(user);
      console.log("returned token", { token });
      return res.status(200).json({
        status: "success",
        message: "Email Verified. Login To Continue.",
        data: {
          token,
          registeredWith: user.signupMethod,
        },
      });
    }

    // === PART 2: Initial Signup (Before Verification) ===
    if (!password || !email) {
      return res.status(400).json({
        status: "error",
        message: "Password and email are required",
      });
    }

    const trimmedEmail = email.trim();

    // Check if email already exists
    const existingUser = await User.findOne({ email: trimmedEmail });
    if (existingUser) {
      return res.status(409).json({
        status: "error",
        message: "User with this email already exists",
      });
    }

    // Generate Serial Number
    const serialNumber = await User.getNextSerialNumber();

    // Generate Email Verification Token
    const emailVerificationToken = crypto.randomBytes(32).toString("hex");

    const referralCodeRaw = email + Date.now();
    const referralCode = crypto
      .createHash("sha256")
      .update(referralCodeRaw)
      .digest("hex")
      .slice(0, 16);

    let referredBy = null;
    // let referredByAdmin = null;

    // if (tenantId) {
    //   const referringAdmin = await User.findOne({ tenantId, role: "admin" });

    //   if (referringAdmin) {
    //     referredByAdmin = referringAdmin._id;
    //   } else {
    //     return res.status(400).json({
    //       status: "error",
    //       message: "Invalid tenant ID",
    //     });
    //   }
    // } else
    if (referralCodeParam) {
      const referringUser = await User.findOne({
        referralCode: referralCodeParam,
      });

      // if (referringUser) {
      // const previouslyReferred = await User.findOne({
      //   myReferrals: { $elemMatch: { email: trimmedEmail } },
      //   // email: trimmedEmail,
      //   // $or: [
      //   //   { referredBy: referringUser._id },
      //   //   { referralCode: referralCodeParam }
      //   // ]
      // });

      // if (previouslyReferred) {
      //   return res.status(400).json({
      //     status: "error",
      //     message: "This referral link has already been used with this email. Please sign up manually.",
      //   });
      // }

      const previouslyReferred = await ReferralLog.findOne({
        email: trimmedEmail,
      });

      if (previouslyReferred) {
        return res.status(400).json({
          status: "error",
          message:
            "This referral link has already been used with this email. Please sign up manually.",
        });
      }

      referredBy = referringUser._id;
      // }
    }

    // Create new user without plan (plan will be assigned after email verification)
    const newUser = await User.create({
      email: trimmedEmail,
      password,
      firstname,
      lastname,
      serialNumber,
      isVerified: false,
      signupMethod: "email",
      role: "user",
      emailVerificationToken,
      referralCode, // 🔥 store user’s unique referral code
      isActive: true, // User is not active until email verification
      // referredByAdmin,
      referredBy,
    });

    // No plan assignment here - will be done after email verification

    if (referredBy) {
      const referrer = await User.findById(referredBy);
      await ReferralLog.create({
        email: newUser.email,
        referredBy: referredBy,
        referredUserId: newUser._id,
      });
      // if (referrer) {
      //   referrer.myReferrals.push({
      //     _id: newUser._id,
      //     firstname: newUser.firstname,
      //     lastname: newUser.lastname,
      //     email: newUser.email,
      //     phonenumbers: newUser.phonenumbers,
      //     signupDate: new Date(),
      //   });

      //   referrer.creditBalance = (referrer.creditBalance || 0) + 10;

      //   await referrer.save();
      // }
      if (referrer) {
        // referrer.myReferrals.push({
        //   _id: newUser._id,
        //   firstname: newUser.firstname || "",
        //   lastname: newUser.lastname || "",
        //   email: newUser.email || "",
        //   phonenumbers: Array.isArray(newUser.phonenumbers)
        //     ? newUser.phonenumbers.map(p => ({
        //       countryCode: (p.countryCode || "").toString().replace(/^\+/, ""),
        //       number: (p.number || "").toString().replace(/^\+/, "")
        //     }))
        //     : [],
        //   signupDate: new Date(),
        // });

        // referrer.creditBalance = (referrer.creditBalance || 0) + 10;
        // await referrer.save();
        console.log("calling add or upate referral");
        await addOrUpdateReferral(referredBy, newUser);
      }
      // newUser.creditBalance = (newUser.creditBalance || 0) + 10;
      // await newUser.save(); // ✅ THIS LINE IS REQUIRED
    }

    console.log(newUser.creditBalance);

    let referUrl = `${FRONTEND_URL}/register?ref=${newUser.referralCode}`;

    let verificationLink = "";

    if (referralCodeParam) {
      verificationLink = `${FRONTEND_URL}/user-verification?verificationToken=${newUser.emailVerificationToken}&ref=${referralCodeParam}`;
    } else {
      verificationLink = `${FRONTEND_URL}/user-verification?verificationToken=${newUser.emailVerificationToken}`;
    }

    // Send verification email

    await sendVerificationEmail(newUser.email, verificationLink);

    console.log("Verification Link:", verificationLink);

    // newUser.isActive = true; // mark as active

    return res.status(201).json({
      status: "success",
      message: "Signup started. Verify Email to Active Account.",
      data: {
        _id: newUser._id,
        email: newUser.email,
        registeredWith: newUser.signupMethod,
        referUrl,
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

const signupWithPhoneNumber = async (req, res) => {
  try {
    const {
      countryCode,
      phonenumber,
      password,
      otp,
      firstname,
      lastname,
      resendOtp = false,
      apiType = "mobile",
    } = req.body;

    const referralCodeParam = req.body.referralCode || req.query.ref || "";

    if (!phonenumber || !password) {
      return res.status(400).json({
        status: "error",
        message: "Phone number and password are required",
      });
    }

    // ---------- NORMALIZE PHONE ----------
    // Use our helper which understands both "mobile" (separate cc + number)
    // and "web" (combined like "917046658651").
    const { countryCode: sanitizedCountryCode, number: sanitizedNumber } =
      normalizePhone({ phonenumber, countryCode, apiType });

    if (!sanitizedNumber) {
      return res.status(400).json({
        status: "error",
        message:
          "Unable to parse phone number. Please include country code or send valid phone.",
      });
    }

    // ---------- find existing user by structured phonenumbers ----------
    let user = await User.findOne({
      phonenumbers: {
        $elemMatch: {
          countryCode: sanitizedCountryCode,
          number: sanitizedNumber,
        },
      },
    });

    const generateOtp = () =>
      Math.floor(100000 + Math.random() * 900000).toString();

    // === Step 1: No OTP or resendOtp -> generate/send OTP ===
    if (!otp || resendOtp) {
      if (user && user.isVerified && !resendOtp) {
        return res.status(409).json({
          status: "error",
          message: "User with this phone number already exists. Please login.",
        });
      }

      const generatedOtp = generateOtp();
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
      const tempSerialNumber = Date.now() + Math.floor(Math.random() * 1000);

      user = await User.findOneAndUpdate(
        {
          phonenumbers: {
            $elemMatch: {
              countryCode: sanitizedCountryCode,
              number: sanitizedNumber,
            },
          },
        },
        {
          $setOnInsert: { serialNumber: tempSerialNumber },
          $set: {
            otp: generatedOtp,
            otpExpiresAt,
            firstname,
            lastname,
            signupMethod: "phoneNumber",
            phonenumbers: [
              { countryCode: sanitizedCountryCode, number: sanitizedNumber },
            ],
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      try {
        const phoneForWhatsAppApi = `+${sanitizedCountryCode}${sanitizedNumber}`;
        await sendWhatsAppOtp(phoneForWhatsAppApi, generatedOtp);
      } catch (error) {
        console.error(
          "OTP Send Failed ❌",
          error.response?.data || error.message
        );
        return res.status(500).json({
          status: "error",
          message: "Failed to send WhatsApp OTP",
          error: error.response?.data || error.message,
        });
      }

      return res.status(200).json({
        status: "pending",
        message: resendOtp ? "OTP Resent to WhatsApp" : "OTP Sent to WhatsApp",
      });
    }

    // === Step 2: OTP present -> verify/create user ===
    if (!user) {
      return res.status(400).json({
        status: "error",
        message:
          "No signup request found for this phone number. Please request a new OTP.",
      });
    }

    if (user.isVerified) {
      return res.status(409).json({
        status: "error",
        message: "User with this phone number already verified. Please login.",
      });
    }

    if (user.otp !== otp) {
      return res.status(400).json({
        status: "error",
        message: "Invalid OTP",
      });
    }

    if (user.otpExpiresAt < new Date()) {
      return res.status(400).json({
        status: "error",
        message: "OTP has expired. Please request a new OTP.",
      });
    }

    // OTP valid → finalize signup
    const serialNumber = await User.getNextSerialNumber();
    let userDetails = user.toObject();

    // strip sensitive
    delete userDetails.password;
    delete userDetails.otp;
    delete userDetails.otpExpiresAt;
    delete userDetails.emailVerificationToken;
    delete userDetails.resetPasswordToken;
    delete userDetails.resetPasswordExpires;

    // set final fields consistently
    userDetails.serialNumber = serialNumber;
    userDetails.firstname = firstname;
    userDetails.lastname = lastname;
    userDetails.phonenumbers = [
      { countryCode: sanitizedCountryCode, number: sanitizedNumber },
    ];
    userDetails.signupMethod = "phoneNumber";
    userDetails.provider = "local";

    // finalize user object
    user.serialNumber = serialNumber;
    user.isVerified = true;
    user.signupMethod = "phoneNumber";
    user.role = "user";
    user.password = password;
    user.firstname = firstname;
    user.lastname = lastname;

    // clear OTP
    user.otp = undefined;
    user.otpExpiresAt = undefined;

    // ---------- scannedMe / iScanned matching ----------
    const matchConditions = [];
    if (user.email) matchConditions.push({ email: user.email });
    if (user.phonenumbers?.[0]) {
      matchConditions.push({
        phonenumbers: {
          $elemMatch: {
            countryCode: user.phonenumbers[0].countryCode,
            number: user.phonenumbers[0].number,
          },
        },
      });
    }

    if (matchConditions.length > 0) {
      const matchingUsers = await User.find({
        scannedMe: { $elemMatch: { $or: matchConditions } },
      });

      // helper to compare various stored formats
      const equalPhone = (entryPhone, userPhoneObj) => {
        if (!entryPhone) return false;
        // entryPhone can be string or object
        if (typeof entryPhone === "string") {
          const raw = entryPhone.replace(/\D/g, "");
          const u = `${userPhoneObj.countryCode}${userPhoneObj.number}`;
          return raw === u || raw === userPhoneObj.number || raw === `+${u}`;
        }
        if (
          typeof entryPhone === "object" &&
          entryPhone.countryCode &&
          entryPhone.number
        ) {
          return (
            entryPhone.countryCode === userPhoneObj.countryCode &&
            entryPhone.number === userPhoneObj.number
          );
        }
        return false;
      };

      for (const scanner of matchingUsers) {
        let updated = false;

        scanner.scannedMe = scanner.scannedMe.map((entry) => {
          if (
            typeof entry === "object" &&
            ((entry.email && entry.email === user.email) ||
              (entry.phonenumber &&
                equalPhone(entry.phonenumber, user.phonenumbers[0])))
          ) {
            updated = true;
            return user._id;
          }
          return entry;
        });

        if (updated) await scanner.save();

        if (!Array.isArray(user.iScanned)) user.iScanned = [];

        const alreadyAdded = user.iScanned.some((entry) => {
          if (typeof entry === "object" && entry._id)
            return entry._id.toString() === scanner._id.toString();
          return entry.toString() === scanner._id.toString();
        });

        if (!alreadyAdded) {
          user.iScanned.push({
            _id: scanner._id,
            firstname: scanner.firstname || "",
            lastname: scanner.lastname || "",
            email: scanner.email || "",
            phonenumbers: scanner.phonenumbers || [],
            profileImageURL: scanner.profileImageURL || "",
          });
        }
      }
    }

    // Plan is now derived from subscription, no need to store in user

    const referralCodeRaw = `${sanitizedCountryCode}${sanitizedNumber}${Date.now()}`;
    user.referralCode = crypto
      .createHash("sha256")
      .update(referralCodeRaw)
      .digest("hex")
      .slice(0, 16);

    if (referralCodeParam) {
      const referringUser = await User.findOne({
        referralCode: referralCodeParam,
      });

      const previouslyReferred = await ReferralLog.findOne({
        phonenumbers: {
          $elemMatch: {
            countryCode: sanitizedCountryCode,
            number: sanitizedNumber,
          },
        },
      });

      if (
        previouslyReferred &&
        previouslyReferred.referredUserId?.toString() !== user._id.toString()
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "This referral link has already been used with this phone number. Please sign up manually.",
        });
      }

      // if (referringUser) {
      //   user.referredBy = referringUser._id;
      //   referringUser.myReferrals.push({
      //     _id: user._id,
      //     firstname: user.firstname,
      //     lastname: user.lastname,
      //     email: user.email,
      //     phonenumbers: user.phonenumbers,
      //     signupDate: new Date(),
      //   });

      //   referringUser.creditBalance = (referringUser.creditBalance || 0) + 10;
      //   user.creditBalance = (user.creditBalance || 0) + 10;
      //   await referringUser.save();

      //   await ReferralLog.create({
      //     phonenumbers: [{ countryCode: sanitizedCountryCode, number: sanitizedNumber }],
      //     referredBy: referringUser._id,
      //     referredUserId: user._id,
      //   });
      // }

      if (referringUser) {
        user.referredBy = referringUser._id;

        // referringUser.myReferrals.push({
        //   _id: user._id,
        //   firstname: user.firstname || "",
        //   lastname: user.lastname || "",
        //   email: user.email || "",
        //   phonenumbers: Array.isArray(user.phonenumbers)
        //     ? user.phonenumbers.map(p => ({
        //       countryCode: (p.countryCode || "").toString().replace(/^\+/, ""),
        //       number: (p.number || "").toString().replace(/^\+/, "")
        //     }))
        //     : [],
        //   signupDate: new Date(),
        // });

        // referringUser.creditBalance = (referringUser.creditBalance || 0) + 10;
        // user.creditBalance = (user.creditBalance || 0) + 10;
        // await referringUser.save();
        await addOrUpdateReferral(referringUser._id, user);

        await ReferralLog.create({
          phonenumbers: [
            { countryCode: sanitizedCountryCode, number: sanitizedNumber },
          ],
          referredBy: referringUser._id,
          referredUserId: user._id,
        });
      }
    }
    user.isActive = true; // mark as active

    await user.save();

    // Setup initial plan using utility (skip for superadmin)
    let planData = null;
    if (user.role !== "superadmin") {
      planData = await setupInitialPlan(user, user.stripe_test_mode || false);

      // Handle referral credits if user was referred
      if (user.referredBy) {
        // Add $10 referral credits to the current user's cache (will be applied to Stripe on first purchase)
        try {
          user.cache_credits = (user.cache_credits || 0) + 10;
          console.log(
            `Added $10 welcome credit to user cache for user ${user._id}`
          );
        } catch (error) {
          console.error("Error adding welcome credit to user cache:", error);
        }

        // Add $10 referral credits to the referring user
        try {
          const referringUser = await User.findById(user.referredBy);
          if (referringUser) {
            // Check if referring user has made their first purchase
            let hasFirstPurchase = false;
            if (referringUser.stripeCustomerId) {
              hasFirstPurchase = await hasUserMadeFirstPurchase(
                referringUser.stripeCustomerId,
                referringUser.stripe_test_mode || false
              );
            }

            if (hasFirstPurchase) {
              // Add directly to Stripe customer account
              const referrerCustomer = await getOrCreateStripeCustomer(
                referringUser,
                referringUser.stripe_test_mode || false
              );
              await addStripeCredits(
                referrerCustomer.id,
                1000, // $10 in cents
                `Referral bonus - ${
                  user.firstname || "User"
                } verified phone number`,
                referringUser.stripe_test_mode || false
              );
              console.log(
                `Added $10 referral credit directly to Stripe for referring user ${user.referredBy}`
              );
            } else {
              // Add to cache_credits
              referringUser.cache_credits =
                (referringUser.cache_credits || 0) + 10;
              await referringUser.save();
              console.log(
                `Added $10 referral credit to referring user cache ${user.referredBy}`
              );
            }
          }
        } catch (error) {
          console.error(
            "Error adding referral credits to referring user:",
            error
          );
        }
      }
    }

    const token = createTokenforUser(user);
    const referUrl = `${FRONTEND_URL}/register?ref=${user.referralCode}`;

    return res.status(201).json({
      status: "success",
      message: "Phone Signup Completed",
      data: {
        _id: user._id,
        token,
        registeredWith: user.signupMethod,
        referUrl,
      },
    });
  } catch (error) {
    console.error("Signup Error ❌", error);
    return res.status(500).json({
      status: "error",
      message: "Server error during signup",
      error: error.message,
    });
  }
};

const resendVerificationLink = async (req, res) => {
  try {
    const { email = "" } = req.body;

    if (!email || email.trim() === "") {
      return res.status(400).json({
        status: "error",
        message: "Email is required",
      });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User with this email does not exist",
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        status: "error",
        message: "Email is already verified",
      });
    }

    // Generate new token and save
    user.emailVerificationToken = crypto.randomBytes(32).toString("hex");
    await user.save();

    // Build link and send email
    const verificationLink = `${FRONTEND_URL}/user-verification?verificationToken=${user.emailVerificationToken}`;
    await sendVerificationEmail(user.email, verificationLink);

    return res.status(200).json({
      status: "success",
      message: "Verification Email Resent",
      verificationLink,
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to resend verification link",
      error: error.message,
    });
  }
};

const unifiedLogin = async (req, res) => {
  try {
    const {
      email = "",
      phonenumber = "",
      countryCode = "",
      password = "",
      googleToken,
      appleToken,
      apiType = "mobile",
    } = req.body;

    // === EMAIL/PHONE + PASSWORD LOGIN ===
    if ((email || phonenumber) && password && !googleToken && !appleToken) {
      try {
        const trimmedEmail = email?.trim()?.toLowerCase();

        // raw inputs
        const rawPhoneInput = phonenumber || "";
        const rawCountryInput = countryCode || "";
        // const apiType = apiType || "mobile";

        // Normalize phone using helper (handles "917046658651", "+9170466...", separate cc+num, etc.)
        const { countryCode: normCountry, number: normNumber } = normalizePhone(
          {
            phonenumber: rawPhoneInput,
            countryCode: rawCountryInput,
            apiType,
          }
        );

        // Build query conditions
        const queryConditions = [];
        if (trimmedEmail) queryConditions.push({ email: trimmedEmail });

        if (normNumber && normCountry) {
          // we have both number and country
          queryConditions.push({
            phonenumbers: {
              $elemMatch: { number: normNumber, countryCode: normCountry },
            },
          });
        } else if (normNumber) {
          // only number parsed — try to match by stored number or legacy string
          queryConditions.push({
            $or: [
              { "phonenumbers.number": normNumber },
              { phonenumbers: normNumber }, // legacy array-of-strings case
            ],
          });
        }

        if (queryConditions.length === 0) {
          return res.status(400).json({
            status: "error",
            message: "Email or phone number is required",
          });
        }

        const user = await User.findOne({ $or: queryConditions });

        if (!user) {
          return res
            .status(401)
            .json({ status: "error", message: "User not found" });
        }

        // If logging in by email, require email verification
        if (trimmedEmail && !user.isVerified) {
          return res.status(403).json({
            status: "error",
            message: "Please verify your email before logging in",
          });
        }

        // If logging in by phone AND we have both country & number, require OTP verification completed
        if (normNumber && normCountry && !user.isVerified) {
          return res.status(403).json({
            status: "error",
            message: "Please complete signup and verify OTP first",
          });
        }

        // Prevent wrong login method
        if (user.signupMethod === "google") {
          return res.status(400).json({
            status: "error",
            message:
              "This user signed up with Google. Please use Google login.",
          });
        }
        if (user.signupMethod === "linkedin") {
          return res.status(400).json({
            status: "error",
            message:
              "This user signed up with linkedin. Please use linkedin login.",
          });
        }
        if (user.signupMethod === "apple") {
          return res.status(400).json({
            status: "error",
            message: "This user signed up with Apple. Please use Apple login.",
          });
        }

        if (user.signupMethod === "phoneNumber" && trimmedEmail) {
          return res.status(400).json({
            status: "error",
            message:
              "This user signed up with phone number. Please login with phone number and password.",
          });
        }

        if (user.signupMethod === "email" && (normNumber || rawPhoneInput)) {
          return res.status(400).json({
            status: "error",
            message:
              "This user signed up with email. Please login with email and password.",
          });
        }

        // Generate token (pass normalized phone fields)
        const token = await User.matchPasswordAndGenerateToken({
          email: trimmedEmail,
          phonenumber: normNumber,
          countryCode: normCountry,
          password,
        });
        await getOrCreateStripeCustomer(user, user.stripe_test_mode || false);
        console.log("set up initial plan for user during login:");

        const now = new Date();
        const isTrialActive = user.trialEnd && now < user.trialEnd;
        user.isActive = true; // mark as active
        return res.json({
          status: "success",
          message: "Account Login...",
          data: {
            token,
            isTrialActive,
            trialEndsAt: user.trialEnd,
            registeredWith: user.signupMethod,
            role: user.role || "user",
          },
        });
      } catch (err) {
        return res.status(401).json({
          status: "error",
          message: err.message || "Invalid credentials",
        });
      }
    }

    // === GOOGLE LOGIN ===
    if (googleToken && !email && !password && !appleToken && !phonenumber) {
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken: googleToken,
          // audience: "308171825690-9tdne4lk5cof1rcmosck65i5iij46bvh.apps.googleusercontent.com",
          audience:
            "308171825690-ukpu99fsh0jsojolv0j4vrhidait4s5b.apps.googleusercontent.com",
        });

        const { email } = ticket.getPayload();
        let user = await User.findOne({ email });
        let isFirstTime = false;

        if (!user) {
          isFirstTime = true;

          const referralCodeParam =
            req.body.referralCode || req.query.ref || "";
          let referredBy = null;

          if (referralCodeParam) {
            const referringUser = await User.findOne({
              referralCode: referralCodeParam,
            });

            if (!referringUser) {
              return res.status(400).json({
                status: "error",
                message: "Invalid referral code",
              });
            }

            const previouslyReferred = await User.findOne({
              email,
              $or: [
                { referredBy: referringUser._id },
                { referralCode: referralCodeParam },
              ],
            });

            if (previouslyReferred) {
              return res.status(400).json({
                status: "error",
                message:
                  "This referral link has already been used with this email. Please sign up manually.",
              });
            }

            referredBy = referringUser._id;
          }

          const serialNumber = await User.getNextSerialNumber();
          const firstname = ticket.getPayload().given_name || "Google";
          const lastname = ticket.getPayload().family_name || "User";
          // const { qrCode } = await generateUserQRCode(firstname, serialNumber, {
          //   firstname,
          //   lastname,
          //   email,
          //   provider: "google"
          // });

          const now = new Date();
          const trialEnds = new Date(now);
          trialEnds.setDate(trialEnds.getDate() + 14); // Set 14-day trial

          const referralCodeRaw = email + Date.now();
          const referralCode = crypto
            .createHash("sha256")
            .update(referralCodeRaw)
            .digest("hex")
            .slice(0, 16);

          user = await User.create({
            email,
            firstname,
            lastname,
            provider: "google",
            serialNumber,
            // qrCode,
            signupMethod: "google",
            isVerified: true,
            trialStart: now,
            trialEnd: trialEnds,
            referralCode, // ✅ Store generated referral code
            referredBy, // ✅ Store who referred this user
          });

          // ✅ Add new user to referring user’s myReferrals
          if (referredBy) {
            const referrer = await User.findById(referredBy);
            if (referrer) {
              referrer.myReferrals.push({
                _id: user._id,
                firstname: user.firstname,
                lastname: user.lastname,
                email: user.email,
                phonenumbers: user.phonenumbers || [],
                signupDate: new Date(),
              });

              // Add credits to referrer using Stripe billing credits
              try {
                const referrerCustomer = await getOrCreateStripeCustomer(
                  referrer,
                  referrer.stripe_test_mode || false
                );
                await addStripeCredits(
                  referrerCustomer.id,
                  1000,
                  "Referral bonus - phone verification",
                  referrer.stripe_test_mode || false
                ); // $10 in cents
              } catch (error) {
                console.error(
                  "Error adding Stripe credits to referrer:",
                  error
                );
              }
              await referrer.save();
            }

            // Add credits to user using Stripe billing credits
            try {
              const userCustomer = await getOrCreateStripeCustomer(
                user,
                user.stripe_test_mode || false
              );
              await addStripeCredits(
                userCustomer.id,
                1000,
                "Welcome bonus - phone verification",
                user.stripe_test_mode || false
              ); // $10 in cents
            } catch (error) {
              console.error("Error adding Stripe credits to user:", error);
            }
            await user.save();
          }
        }

        const token = createTokenforUser(user);
        const now = new Date();
        const isTrialActive = user.trialEnd && now < user.trialEnd;
        return res.json({
          status: "success",
          message: "Google login successful",
          data: {
            token: token,
            registeredWith: user.signupMethod,
            isFirstTime: isFirstTime,
            isTrialActive,
            trialEndsAt: user.trialEnd,
          },
        });
      } catch (err) {
        console.log(err);
        return res
          .status(500)
          .json({ status: "error", message: "Google login failed" });
      }
    }

    // === APPLE LOGIN ===
    if (appleToken && !email && !password && !googleToken && !phonenumber) {
      try {
        let id_token = appleToken;

        if (!id_token.includes(".")) {
          const decoded = Buffer.from(id_token, "base64").toString("utf8");
          if (!decoded.includes(".")) {
            return res
              .status(400)
              .json({ message: "Invalid Apple token format" });
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
          const serialNumber = await User.getNextSerialNumber();
          const firstname = appleUser.firstName || "Apple";
          const lastname = appleUser.lastName || "User";

          // const { qrCode } = await generateUserQRCode(firstname, serialNumber, {
          //   firstname,
          //   lastname,
          //   email: appleEmail,
          //   provider: "apple"
          // });

          const now = new Date();
          const trialEnds = new Date(now);
          trialEnds.setDate(trialEnds.getDate() + 14); // Set 14-day trial

          user = await User.create({
            email: appleEmail,
            provider: "apple",
            firstname,
            lastname,
            serialNumber,
            // qrCode,
            signupMethod: "apple",
            trialStart: now,
            trialEnd: trialEnds,
          });
        }

        const token = createTokenforUser(user);
        const now = new Date();
        const isTrialActive = user.trialEnd && now < user.trialEnd;
        return res.json({
          status: "success",
          message: "Apple login successful",
          data: {
            token,
            isTrialActive,
            trialEndsAt: user.trialEnd,
          },
        });
      } catch (err) {
        return res
          .status(500)
          .json({ status: "error", message: "Apple login failed" });
      }
    }

    return res
      .status(400)
      .json({ status: "error", message: "Invalid login request" });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Login failed" });
  }
};

const startGoogleLogin = (req, res) => {
  const { ref = "" } = req.query;

  const scopes = [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scopes,
    state: JSON.stringify({ ref }), // Pass referral code in state
  });

  return res.json({
    status: "success",
    message: "Google OAuth URL generated",
    url: url,
  });
};

const googleCallback = async (req, res) => {
  // const { code } = req.query;

  const { code, state } = req.query;
  let referralCode = "";
  // let tenantId = "";
  try {
    const parsedState = JSON.parse(state || "{}");
    referralCode = parsedState.ref || "";
    // tenantId = parsedState.tenantId || "";
  } catch (err) {
    referralCode = "";
  }

  if (!code) {
    return res
      .status(400)
      .json({ status: "error", message: "Missing authorization code" });
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({
      auth: oauth2Client,
      version: "v2",
    });

    const { data } = await oauth2.userinfo.get();
    const { email, given_name, family_name } = data;

    let user = await User.findOne({ email });
    let isFirstTime = false;

    // if (!user) {
    //   let referral = null;

    //   if (referralCode) {
    //     referral = await Referral.findOne({ referralCode });

    //     if (!referral) {
    //       return res.send(`
    //         <script>
    //           window.opener.postMessage({ status: 'error', message: 'Invalid referral code' }, '*');
    //           window.close();
    //         </script>
    //       `);
    //     }

    //     // if (referral.usedOnce) {
    //     //   return res.send(`
    //     //     <script>
    //     //       window.opener.postMessage({ status: 'error', message: 'Referral code already used' }, '*');
    //     //       window.close();
    //     //     </script>
    //     //   `);
    //     // }
    //     const alreadyUsed = await hasUsedReferralBefore({ email, phonenumbers });
    //     if (alreadyUsed) {
    //       return res.send(`
    //     <script>
    //       window.opener.postMessage({ status: 'error', message: 'Referral already used with this email or phone. Please sign up manually.' }, '*');
    //       window.close();
    //     </script>
    //   `);
    //     }
    //   }

    //   isFirstTime = true;
    //   const serialNumber = await getNextSerialNumber();
    //   const firstname = given_name || "Google";
    //   const lastname = family_name || "User";

    //   const { qrCode } = await generateUserQRCode(firstname, serialNumber, {
    //     firstname,
    //     lastname,
    //     email,
    //     provider: "google"
    //   });

    //   const now = new Date();
    //   const trialEnds = new Date(now);
    //   trialEnds.setDate(trialEnds.getDate() + 14); // Set 14-day trial

    //   user = await User.create({
    //     email,
    //     firstname,
    //     lastname,
    //     provider: "google",
    //     serialNumber,
    //     qrCode,
    //     signupMethod: "google",
    //     isVerified: true,
    //     trialStart: now,
    //     trialEnd: trialEnds,
    //   });
    //   if (referral) {
    //     referral.status = "complete";
    //     referral.referredUserId = user._id;
    //     // referral.usedOnce = true;

    //     if (user.email) referral.email = user.email;
    //     if (user.phonenumbers?.[0]) referral.phonenumbers = user.phonenumbers[0];

    //     await referral.save();
    //   }
    // }
    let referralUrl = "";
    if (!user) {
      isFirstTime = true;
      let referredBy = null;
      // let referredByAdmin = null;
      // if (tenantId) {
      //   const referringAdmin = await User.findOne({ tenantId, role: "admin" });

      //   if (!referringAdmin) {
      //     return res.send(`
      //   <script>
      //     window.opener.postMessage({ status: 'error', message: 'Invalid tenant ID' }, '*');
      //     window.close();
      //   </script>
      // `);
      //   }
      //   referredByAdmin = referringAdmin._id;
      // } else
      if (referralCode) {
        const referringUser = await User.findOne({
          referralCode: referralCode,
        });

        if (!referringUser) {
          return res.send(`
        <script>
          window.opener.postMessage({ status: 'error', message: 'Invalid referral code' }, '*');
          window.close();
        </script>
      `);
        }

        //   const previouslyReferred = await User.findOne({
        //     myReferrals: { $elemMatch: { email } },
        //     // email,
        //     $or: [
        //       { referredBy: referringUser._id },
        //       { referralCode: referralCode }
        //     ]
        //   });

        //   if (previouslyReferred) {
        //     return res.send(`
        //   <script>
        //     window.opener.postMessage({ status: 'error', message: 'Referral already used with this email. Please sign up manually.' }, '*');
        //     window.close();
        //   </script>
        // `);
        //   }

        const previouslyReferred = await ReferralLog.findOne({
          email: email,
        });

        if (previouslyReferred) {
          return res.send(`
    <script>
      window.opener.postMessage({ status: 'error', message: 'Referral already used with this email. Please sign up manually.' }, '*');
      window.close();
    </script>
  `);
        }

        referredBy = referringUser._id;
      }

      const serialNumber = await User.getNextSerialNumber();
      const firstname = given_name || "Google";
      const lastname = family_name || "User";

      // const { qrCode } = await generateUserQRCode(firstname, serialNumber, {
      //   firstname,
      //   lastname,
      //   email,
      //   provider: "google"
      // });

      // Setup initial plan using utility - pass temporary user data for Stripe customer creation
      const tempUser = {
        _id: new (require("mongoose").Types.ObjectId)(),
        email,
        firstname,
        lastname,
        signupMethod: "google",
      };

      let planData = null;
      if (tempUser.role !== "superadmin") {
        planData = await setupInitialPlan(
          tempUser,
          tempUser.stripe_test_mode || false
        );
      }

      const referralCodeRaw = email + Date.now();
      const userReferralCode = crypto
        .createHash("sha256")
        .update(referralCodeRaw)
        .digest("hex")
        .slice(0, 16);
      referralUrl = `${FRONTEND_URL}/register?ref=${userReferralCode}`;
      user = await User.create({
        email,
        firstname,
        lastname,
        provider: "google",
        serialNumber,
        // qrCode,
        signupMethod: "google",
        role: "user", // Default role for new users
        isVerified: true,
        isActive: true,
        referralCode: userReferralCode,
        referredBy: referredBy,

        // referredByAdmin: referredByAdmin
      });

      // if (referredBy) {
      //   const referrer = await User.findById(referredBy);
      //   if (referrer) {
      //     referrer.myReferrals.push({
      //       _id: user._id,
      //       firstname: user.firstname,
      //       lastname: user.lastname,
      //       email: user.email,
      //       phonenumbers: user.phonenumbers || [],
      //       signupDate: new Date(),
      //     });
      //     referrer.creditBalance = (referrer.creditBalance || 0) + 10;
      //     await referrer.save();
      //   }
      //   user.creditBalance = (user.creditBalance || 0) + 10;
      //   await user.save();
      //   await ReferralLog.create({
      //     email: user.email,
      //     referredBy: referrer._id,
      //     referredUserId: user._id,
      //   });
      // }

      if (referredBy) {
        // use helper to add/update referral + log + credits
        await addOrUpdateReferral(referredBy, user);
      }
    }

    // ✅ Sync referral data (in case user was referred but referrer has missing details)
    // try {
    //   if (user.referredBy) {
    //     const referrer = await User.findById(user.referredBy);

    //     if (referrer && referrer.myReferrals?.length > 0) {
    //       const index = referrer.myReferrals.findIndex(r => r._id.toString() === user._id.toString());

    //       if (index !== -1) {
    //         let needsUpdate = false;

    //         if (!referrer.myReferrals[index].firstname && user.firstname) {
    //           referrer.myReferrals[index].firstname = user.firstname;
    //           needsUpdate = true;
    //         }

    //         if (!referrer.myReferrals[index].lastname && user.lastname) {
    //           referrer.myReferrals[index].lastname = user.lastname;
    //           needsUpdate = true;
    //         }

    //         if (!referrer.myReferrals[index].email && user.email) {
    //           referrer.myReferrals[index].email = user.email;
    //           needsUpdate = true;
    //         }

    //         if (
    //           (!referrer.myReferrals[index].phonenumbers || referrer.myReferrals[index].phonenumbers.length === 0) &&
    //           user.phonenumbers?.length > 0
    //         ) {
    //           referrer.myReferrals[index].phonenumbers = user.phonenumbers;
    //           needsUpdate = true;
    //         }

    //         if (needsUpdate) {
    //           referrer.myReferrals[index].signupDate = user.createdAt || new Date();
    //           await referrer.save();
    //         }
    //       }
    //     }
    //   }
    // } catch (err) {
    //   console.error("Failed to sync referral data in Google login:", err.message);
    // }

    const token = createTokenforUser(user);

    // ✅ Redirect based on whether it's first time
    // return res.json({
    //   status: 'success',
    //   message: 'Google login successful',

    // });
    const resultData = {
      status: "success",
      message: "Google Login successfully",
      data: {
        token: token,
        isFirstTime: isFirstTime,
        referralUrl: referralUrl || "",
        registeredWith: user.signupMethod,
      },
    };

    // Detect if request is from mobile (simple detection by user-agent or query flag)
    // const isMobile = /Mobile|Android|iPhone|iPad/i.test(req.headers['user-agent'] || '');

    // if (isMobile) {
    //   // Return pure JSON for mobile apps
    //   return res.json({
    //     status: 'success',
    //     message: 'Google Login successfully',
    //     data: {
    //       token: token,
    //       isFirstTime: isFirstTime,
    //       referralUrl: referralUrl || "",
    //       registeredWith: user.signupMethod,
    //     }
    //   });
    // }

    // console.log(resultData);

    // return res.status(200).json({
    //   status: "success",
    //   message: "Google Login successfully",
    //   data: {
    //     token: token,
    //     isFirstTime: isFirstTime,
    //     referralUrl: referralUrl || "",
    //     registeredWith: user.signupMethod,
    //   }
    // });

    return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Google Connected</title>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    text-align: center; 
                    padding-top: 50px; 
                }
                .success { color: green; font-size: 18px; margin-bottom: 20px; }
            </style>
        </head>
        <body>
            <div class="success">Google Login Successfully! You can close this window.</div>
            <script>
                window.opener.postMessage(${JSON.stringify(resultData)}, '*');
                window.close();
            </script>
        </body>
        </html>
    `);

    // const redirectUrl = isFirstTime
    //   ? `https://app.contacts.management/registration-form?token=${token}&isFirstTime=true`
    //   : `https://app.contacts.management/dashboard?token=${token}&isFirstTime=false`;

    // return res.redirect(redirectUrl);
  } catch (error) {
    console.log("Google Callback Error:", error);

    return res.send(`
            <script>
                window.opener.postMessage({ status: 'error', message: 'Google login callback failed', error: '${error.message}' }, '*');
                window.close();
            </script>
        `);
    // return res.status(500).json({
    //   status: "error",
    //   message: "Google login callback failed",
    // });
  }
};

const startLinkedInLogin = (req, res) => {
  const { ref = "" } = req.query;

  const scope = ["openid", "profile", "email"].join(" ");
  const authUrl =
    "https://www.linkedin.com/oauth/v2/authorization?" +
    querystring.stringify({
      response_type: "code",
      client_id: process.env.LINKEDIN_CLIENT_ID,
      redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
      scope: scope,
      // state: 'linkedin_login_' + Date.now()
      state: JSON.stringify({ ref, ts: Date.now() }), // store ref in state
    });

  console.log(process.env.LINKEDIN_CLIENT_ID);

  return res.json({
    status: "success",
    message: "LinkedIn OAuth URL generated",
    url: authUrl,
  });
};

const linkedinCallback = async (req, res) => {
  // const { code } = req.query;
  const { code, state } = req.query;

  let referralCode = "";
  try {
    const parsedState = JSON.parse(state || "{}");
    referralCode = parsedState.ref || "";
  } catch (err) {
    referralCode = "";
  }

  console.log("LinkedIn Callback Code:", code);

  if (!code) {
    return res
      .status(400)
      .json({ status: "error", message: "Missing authorization code" });
  }

  try {
    // 1. Exchange code for access token
    const tokenRes = await axios.post(
      "https://www.linkedin.com/oauth/v2/accessToken",
      querystring.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET,
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    const accessToken = tokenRes.data.access_token;

    // 2. Get user profile (name)
    const userInfoRes = await axios.get(
      "https://api.linkedin.com/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    // const firstname = userInfoRes.data.given_name || 'LinkedIn';
    // const lastname = userInfoRes.data.family_name || 'User';
    // const email = userInfoRes.data.email || 'unknown@example.com';

    const firstname = userInfoRes.data.given_name || "LinkedIn";
    const lastname = userInfoRes.data.family_name || "User";
    const email = userInfoRes.data.email || "unknown@example.com";
    const phonenumbers = userInfoRes.data.phone_number || null; // if phone number is available
    // const firstname = profileRes.data.localizedFirstName || "LinkedIn";
    // const lastname = profileRes.data.localizedLastName || "User";
    // const email = emailRes.data.elements[0]['handle~'].emailAddress;

    // let user = await User.findOne({ email });
    // let isFirstTime = false;

    // if (!user) {
    //   isFirstTime = true;
    //   const serialNumber = await getNextSerialNumber();

    //   const { qrCode } = await generateUserQRCode(firstname, serialNumber, {
    //     firstname,
    //     lastname,
    //     email,
    //     provider: "linkedin"
    //   });

    //   user = await User.create({
    //     email,
    //     firstname,
    //     lastname,
    //     provider: "linkedin",
    //     serialNumber,
    //     qrCode,
    //     signupMethod: "linkedin",
    //     isVerified: true
    //   });
    // }

    // 🔁 Replace the following section
    let user = await User.findOne({
      $or: [
        { email: email },
        phonenumbers ? { phone: phonenumbers } : null,
      ].filter(Boolean), // removes null if phoneNumber is not available
    });

    let isFirstTime = false;

    // ✅ Prevent login if already registered with another method
    if (user && user.signupMethod !== "linkedin") {
      const method =
        user.signupMethod === "google"
          ? "Google"
          : user.signupMethod === "email"
          ? "Email"
          : user.signupMethod === "phoneNumber"
          ? "Phone Number"
          : "Other";

      const conflictField = user.email === email ? "email" : "phone number";

      return res.send(`
        <!DOCTYPE html>
    <html>
    <head>
        <title>LinkedIn Connected</title>
        <style>
            body { font-family: Arial, sans-serif; text-align: center; padding-top: 50px; }
            .success { color: green; font-size: 18px; margin-bottom: 20px; }
        </style>
    </head>
    <body>
        <div class="success">This User is already registered using ${method}. Please login using ${method}.</div>
    <script>
      window.opener.postMessage({
        status: 'error',
        message: 'This is already registered using ${method}. Please login using ${method}.'
      }, '*');
      window.close();
    </script>
    </body>
    </html>
  `);
    }

    // ✅ If user does not exist, proceed with LinkedIn signup
    if (!user) {
      isFirstTime = true;

      let referredBy = null;

      if (referralCode) {
        const referringUser = await User.findOne({
          referralCode: referralCode,
        });

        if (!referringUser) {
          return res.send(`
        <script>
          window.opener.postMessage({ status: 'error', message: 'Invalid referral code' }, '*');
          window.close();
        </script>
      `);
        }

        //   const previouslyReferred = await User.findOne({
        //     myReferrals: { $elemMatch: { email } },
        //     // email,
        //     $or: [
        //       { referredBy: referringUser._id },
        //       { referralCode: referralCode }
        //     ]
        //   });

        //   if (previouslyReferred) {
        //     return res.send(`
        //   <script>
        //     window.opener.postMessage({ status: 'error', message: 'Referral already used with this email. Please sign up manually.' }, '*');
        //     window.close();
        //   </script>
        // `);
        //   }

        const previouslyReferred = await ReferralLog.findOne({ email: email });

        if (previouslyReferred) {
          return res.send(`
    <script>
      window.opener.postMessage({ status: 'error', message: 'Referral already used with this email. Please sign up manually.' }, '*');
      window.close();
    </script>
  `);
        }

        referredBy = referringUser._id;
      }

      const serialNumber = await User.getNextSerialNumber();

      // const { qrCode } = await generateUserQRCode(firstname, serialNumber, {
      //   firstname,
      //   lastname,
      //   email,
      //   provider: "linkedin"
      // });

      // Setup initial plan using utility - pass temporary user data for Stripe customer creation
      const tempUser = {
        _id: new (require("mongoose").Types.ObjectId)(),
        email,
        firstname,
        lastname,
        signupMethod: "linkedin",
      };

      let planData = null;
      if (tempUser.role !== "superadmin") {
        planData = await setupInitialPlan(
          tempUser,
          tempUser.stripe_test_mode || false
        );
      }

      const referralCodeRaw = email + Date.now();
      const userReferralCode = crypto
        .createHash("sha256")
        .update(referralCodeRaw)
        .digest("hex")
        .slice(0, 16);

      user = await User.create({
        email,
        firstname,
        lastname,
        provider: "linkedin",
        serialNumber,
        // qrCode,
        signupMethod: "linkedin",
        role: "user", // Default role for new users
        isVerified: true,
        referralCode: userReferralCode,
        referredBy: referredBy,
        isActive: true,
      });

      // if (referredBy) {
      //   const referrer = await User.findById(referredBy);
      //   if (referrer) {
      //     referrer.myReferrals.push({
      //       _id: user._id,
      //       firstname: user.firstname,
      //       lastname: user.lastname,
      //       email: user.email,
      //       phonenumbers: user.phonenumbers || [],
      //       signupDate: new Date(),
      //     });
      //     referrer.creditBalance = (referrer.creditBalance || 0) + 10;
      //     await referrer.save();
      //   }
      //   user.creditBalance = (user.creditBalance || 0) + 10;
      //   await user.save();
      //   await ReferralLog.create({
      //     email: user.email,
      //     referredBy: referredBy,
      //     referredUserId: user._id,
      //   });
      // }

      if (referredBy) {
        await addOrUpdateReferral(referredBy, user);
      }
    }

    // // ✅ Sync referral data if this user was referred
    // try {
    //   if (user.referredBy) {
    //     const referrer = await User.findById(user.referredBy);

    //     if (referrer && Array.isArray(referrer.myReferrals)) {
    //       const index = referrer.myReferrals.findIndex(r => r._id.toString() === user._id.toString());

    //       if (index !== -1) {
    //         let needsUpdate = false;

    //         if (!referrer.myReferrals[index].firstname && user.firstname) {
    //           referrer.myReferrals[index].firstname = user.firstname;
    //           needsUpdate = true;
    //         }

    //         if (!referrer.myReferrals[index].lastname && user.lastname) {
    //           referrer.myReferrals[index].lastname = user.lastname;
    //           needsUpdate = true;
    //         }

    //         if (!referrer.myReferrals[index].email && user.email) {
    //           referrer.myReferrals[index].email = user.email;
    //           needsUpdate = true;
    //         }

    //         if (
    //           (!referrer.myReferrals[index].phonenumbers || referrer.myReferrals[index].phonenumbers.length === 0) &&
    //           user.phonenumbers?.length > 0
    //         ) {
    //           referrer.myReferrals[index].phonenumbers = user.phonenumbers;
    //           needsUpdate = true;
    //         }

    //         if (needsUpdate) {
    //           referrer.myReferrals[index].signupDate = user.createdAt || new Date();
    //           await referrer.save();
    //         }
    //       }
    //     }
    //   }
    // } catch (err) {
    //   console.error("Referral sync failed (LinkedIn):", err.message);
    // }

    const token = createTokenforUser(user);
    const now = new Date();
    const isTrialActive = user.trialEnd && now < user.trialEnd;
    // user.isActive = true; // mark as active
    const resultData = {
      status: "success",
      message: "LinkedIn Login successfully",
      data: {
        token: token,
        isFirstTime: isFirstTime,
        registeredWith: user.signupMethod,
        hasAccess,
        isTrialActive,
        trialEndsAt: user.trialEnd,
      },
    };

    // console.log(resultData);

    // return res.status(200).json({
    //   status: "success",
    //   message: "LinkedIn Login successfully",
    //   data: {
    //     token: token,
    //     isFirstTime: isFirstTime,
    //     registeredWith: user.signupMethod,
    //     hasAccess,
    //     isTrialActive,
    //     trialEndsAt: user.trialEnd
    //   }
    // });
    return res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>LinkedIn Connected</title>
        <style>
            body { font-family: Arial, sans-serif; text-align: center; padding-top: 50px; }
            .success { color: green; font-size: 18px; margin-bottom: 20px; }
        </style>
    </head>
    <body>
        <div class="success">LinkedIn Login Successfully! You can close this window.</div>
        <script>
            window.opener.postMessage(${JSON.stringify(resultData)}, '*');
            window.close();
        </script>
    </body>
    </html>
    `);
  } catch (error) {
    console.error(
      "LinkedIn Callback Error:",
      error.response?.data || error.message
    );
    return res.send(`
      <script>
        window.opener.postMessage({ status: 'error', message: 'LinkedIn login failed', error: '${error.message}' }, '*');
        window.close();
      </script>
    `);
    // return res.status(500).json({
    //   status: "error",
    //   message: "LinkedIn login failed",
    // });
  }
};

const logoutUser = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const token = req.token || req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(400).json({ message: "Token not found" });
    }

    const decoded = jwt.decode(token);

    // ✅ Safely compute expiry date
    let expiresAt;
    if (decoded && decoded.exp) {
      expiresAt = new Date(decoded.exp * 1000);
    } else {
      // fallback: 1 hour from now (or your JWT lifetime)
      expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    }

    // ✅ Save the blacklisted token
    await BlacklistedToken.create({
      token,
      userId,
      expiresAt,
    });

    // ✅ Mark user inactive
    await User.findByIdAndUpdate(userId, {
      isActive: false,
      lastSeen: new Date(),
    });

    res.json({ message: "Account Logout..." });
  } catch (error) {
    console.error("Logout error:", error);
    res
      .status(500)
      .json({ message: "Error during logout", error: error.message });
  }
};

module.exports = {
  signupWithEmail,
  unifiedLogin,
  resendVerificationLink,
  signupWithPhoneNumber,
  startGoogleLogin,
  googleCallback,
  startLinkedInLogin,
  linkedinCallback,
  logoutUser,
};
