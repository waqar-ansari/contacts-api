const { OAuth2Client } = require("google-auth-library");
const appleSignin = require("apple-signin-auth");
const { createTokenforUser } = require("../services/authentication");
const User = require("../models/userModel");
const { getNextSerialNumber } = require("../utils/serialUtils");
const { generateUserQRCode } = require("../utils/qrUtils");
const crypto = require("crypto");
const { sendVerificationEmail } = require("../utils/emailUtils");
const googleClient = new OAuth2Client("401067515093-9j7faengj216m6uc9csubrmo3men1m7p.apps.googleusercontent.com");
const sendWhatsAppOtp = require('../utils/sendWhatsAppOtp');
require('dotenv').config();
const { google } = require('googleapis');
const querystring = require('querystring');
const axios = require('axios');



const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_LOGIN_URI // e.g. https://yourapi.com/auth/google/callback
);

const signupWithEmail = async (req, res) => {
  try {
    const {
      email = "",
      password,
      firstname = "",
      lastname = "",
      verifyToken = "",
    } = req.body;

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

      if (!user.qrCode) {
        const { qrCode } = await generateUserQRCode(user.firstname || "user", user.serialNumber, {
          firstname: user.firstname,
          lastname: user.lastname,
          email: user.email,
          phonenumbers: user.phonenumbers,
          provider: "local"
        });
        user.qrCode = qrCode;
      }

      // ✅ Optional: Update scannedMe for other users
      let matchConditions = [];
      if (user.email) matchConditions.push({ email: user.email });
      if (user.phonenumbers?.[0]) matchConditions.push({ phonenumber: user.phonenumbers[0] });

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
            profileImageURL: scanner.profileImageURL || ""
          });
        }
      }

      await user.save();

      const token = createTokenforUser(user);

      return res.status(200).json({
        status: "success",
        message: "Email verified successfully. You can now log in.",
        data: {
          token,
          registeredWith: user.signupMethod
        }
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
    const serialNumber = await getNextSerialNumber();

    // Generate Email Verification Token
    const emailVerificationToken = crypto.randomBytes(32).toString("hex");

    // Create new user
    const newUser = await User.create({
      email: trimmedEmail,
      password,
      firstname,
      lastname,
      serialNumber,
      isVerified: false,
      signupMethod: "email",
      emailVerificationToken,
    });

    // Send verification email
    const verificationLink = `https://app.contacts.management/user-verification?verificationToken=${newUser.emailVerificationToken}`;
    await sendVerificationEmail(newUser.email, verificationLink);

    console.log("Verification Link:", verificationLink);

    return res.status(201).json({
      status: "success",
      message: "Signup started. Please verify your email to activate your account.",
      data: {
        _id: newUser._id,
        email: newUser.email,
        registeredWith: newUser.signupMethod,
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
    const { phonenumber, password, otp, firstname, lastname, resendOtp = false } = req.body;

    if (!phonenumber || !password) {
      return res.status(400).json({
        status: "error",
        message: "Phone number and password are required",
      });
    }

    const sanitizedPhone = phonenumber.replace(/[^0-9]/g, "");

    const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

    let user = await User.findOne({ phonenumbers: { $in: [sanitizedPhone] } });

    // === Step 1: If No OTP in Request → Generate and Send OTP ===
    // if (!otp) {

    //   if (phonenumber && phonenumber.trim() !== "") {
    //     const phoneExists = await User.findOne({
    //       phonenumbers: { $in: [phonenumber] },
    //     });
    //     if (phoneExists) {
    //       return res.status(409).json({
    //         status: "error",
    //         message: "User with this phone number already exists",
    //       });
    //     }
    //   }

    //   const generatedOtp = generateOtp();
    //   const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // OTP expiry: 10 mins
    //   const tempSerialNumber = Date.now() + Math.floor(Math.random() * 1000);

    //   user = await User.findOneAndUpdate(
    //     { phonenumbers: { $in: [sanitizedPhone] } },
    //     {
    //       $setOnInsert: { serialNumber: tempSerialNumber },
    //       $set: {
    //         otp: generatedOtp,
    //         otpExpiresAt,
    //         firstname,
    //         lastname,
    //         signupMethod: "phoneNumber",
    //         phonenumbers: [sanitizedPhone], // ✅ Always set as array
    //       },
    //     },
    //     { upsert: true, new: true, setDefaultsOnInsert: true }
    //   );

    //   try {
    //     const phoneForWhatsAppApi = `+${sanitizedPhone}`;
    //     await sendWhatsAppOtp(phoneForWhatsAppApi, generatedOtp);
    //   } catch (error) {
    //     console.error("OTP Send Failed ❌", error.response?.data || error.message);
    //     return res.status(500).json({
    //       status: "error",
    //       message: "Failed to send WhatsApp OTP",
    //       error: error.response?.data || error.message,
    //     });
    //   }

    //   return res.status(200).json({
    //     status: "pending",
    //     message: "OTP sent to your WhatsApp number",
    //   });
    // }

    if (!otp || resendOtp) {
      // ✅ Check if user already exists and is verified
      if (user && user.isVerified && !resendOtp) {
        return res.status(409).json({
          status: "error",
          message: "User with this phone number already exists. Please login.",
        });
      }

      const generatedOtp = generateOtp();
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // OTP expiry: 10 mins
      const tempSerialNumber = Date.now() + Math.floor(Math.random() * 1000);

      user = await User.findOneAndUpdate(
        { phonenumbers: { $in: [sanitizedPhone] } },
        {
          $setOnInsert: { serialNumber: tempSerialNumber },
          $set: {
            otp: generatedOtp,
            otpExpiresAt,
            firstname,
            lastname,
            signupMethod: "phoneNumber",
            phonenumbers: [sanitizedPhone],
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      try {
        const phoneForWhatsAppApi = `+${sanitizedPhone}`;
        await sendWhatsAppOtp(phoneForWhatsAppApi, generatedOtp);
      } catch (error) {
        console.error("OTP Send Failed ❌", error.response?.data || error.message);
        return res.status(500).json({
          status: "error",
          message: "Failed to send WhatsApp OTP",
          error: error.response?.data || error.message,
        });
      }

      return res.status(200).json({
        status: "pending",
        message: resendOtp ? "OTP resent to your WhatsApp number" : "OTP sent to your WhatsApp number",
      });
    }


    // === Step 2: If OTP present → Verify OTP and Create User ===

    if (!user) {
      return res.status(400).json({
        status: "error",
        message: "No signup request found for this phone number. Please request a new OTP.",
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

    // ✅ OTP Verified → Finalize Signup

    const serialNumber = await getNextSerialNumber();

    const { qrCode } = await generateUserQRCode(firstname || "user", serialNumber, {
      firstname,
      lastname,
      phonenumbers: [sanitizedPhone],
      provider: "local",
    });

    user.serialNumber = serialNumber;
    user.isVerified = true;
    user.qrCode = qrCode;
    user.signupMethod = "phoneNumber";
    user.password = password;
    user.firstname = firstname;
    user.lastname = lastname;

    // ✅ Clear OTP fields
    user.otp = undefined;
    user.otpExpiresAt = undefined;

    const matchConditions = [];

    if (user.email) matchConditions.push({ email: user.email });
    if (user.phonenumbers?.[0]) matchConditions.push({ phonenumber: user.phonenumbers[0] });

    if (matchConditions.length > 0) {
      const matchingUsers = await User.find({
        scannedMe: { $elemMatch: { $or: matchConditions } },
      });

      for (const scanner of matchingUsers) {
        let updated = false;

        scanner.scannedMe = scanner.scannedMe.map(entry => {
          if (
            typeof entry === "object" &&
            (
              (entry.email && entry.email === user.email) ||
              (entry.phonenumber && entry.phonenumber === user.phonenumbers[0])
            )
          ) {
            updated = true;
            return user._id;
          }
          return entry;
        });

        if (updated) await scanner.save();

        if (!Array.isArray(user.iScanned)) user.iScanned = [];

        const alreadyAdded = user.iScanned.some(entry => {
          if (typeof entry === "object" && entry._id) return entry._id.toString() === scanner._id.toString();
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
    // ✅ iScanned / scannedMe logic ends here.



    await user.save();

    const token = createTokenforUser(user);

    return res.status(201).json({
      status: "success",
      message: "Phone signup completed successfully",
      data: {
        _id: user._id,
        token,
        registeredWith: user.signupMethod,
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
    const verificationLink = `https://app.contacts.management/user-verification?verificationToken=${user.emailVerificationToken}`;
    await sendVerificationEmail(user.email, verificationLink);

    return res.status(200).json({
      status: "success",
      message: "Verification email resent successfully",
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
    const { email = "", phonenumber = "", password = "", googleToken, appleToken } = req.body;

    //email and phoneNumber Login
    if ((email || phonenumber) && password && !googleToken && !appleToken) {
      try {
        const trimmedEmail = email?.trim()?.toLowerCase();
        const trimmedPhone = phonenumber?.trim();

        let normalizedPhone = trimmedPhone;
        if (normalizedPhone?.startsWith('+')) {
          normalizedPhone = normalizedPhone.slice(1);
        }

        const queryConditions = [];
        if (trimmedEmail) queryConditions.push({ email: trimmedEmail });
        if (normalizedPhone) queryConditions.push({ phonenumbers: { $in: [normalizedPhone] } });

        if (queryConditions.length === 0) {
          return res.status(400).json({ status: "error", message: "Email or phone number is required" });
        }

        const user = await User.findOne({ $or: queryConditions });

        if (!user) {
          return res.status(401).json({ status: "error", message: "User not found" });
        }

        if (trimmedEmail && !user.isVerified) {
          return res.status(403).json({ status: "error", message: "Please verify your email before logging in" });
        }

        if (normalizedPhone && !user.isVerified) {
          return res.status(403).json({ status: "error", message: "Please complete signup and verify OTP first" });
        }

        // ✅ Prevent wrong login method
        if (user.signupMethod === "google") {
          return res.status(400).json({
            status: "error",
            message: "This user signed up with Google. Please use Google login."
          });
        }

        if (user.signupMethod === "apple") {
          return res.status(400).json({
            status: "error",
            message: "This user signed up with Apple. Please use Apple login."
          });
        }

        if (user.signupMethod === "phoneNumber" && trimmedEmail) {
          return res.status(400).json({
            status: "error",
            message: "This user signed up with phone number. Please login with phone number and password."
          });
        }

        if (user.signupMethod === "email" && normalizedPhone) {
          return res.status(400).json({
            status: "error",
            message: "This user signed up with email. Please login with email and password."
          });
        }


        const token = await User.matchPasswordAndGenerateToken({
          email: trimmedEmail,
          phonenumber: normalizedPhone,
          password
        });

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
          audience: "308171825690-ukpu99fsh0jsojolv0j4vrhidait4s5b.apps.googleusercontent.com",
        });

        const { email } = ticket.getPayload();
        let user = await User.findOne({ email });
        let isFirstTime = false;


        if (!user) {
          isFirstTime = true;  // ✅ This means first time Google login (new user)
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
            qrCode,
            signupMethod: "google",
            isVerified: true,      // ✅ Set isVerified at creation time
          });
        }


        const token = createTokenforUser(user);
        return res.json({
          status: "success", message: "Google login successful",
          data: {
            "token": token,
            "registeredWith": user.signupMethod,
            "isFirstTime": isFirstTime
          }
        });
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
            qrCode,
            signupMethod: "apple",
          });
        }

        const token = createTokenforUser(user);
        return res.json({ status: "success", message: "Apple login successful", data: { token } });
      } catch (err) {
        return res.status(500).json({ status: "error", message: "Apple login failed" });
      }
    }

    // === LINKEDIN LOGIN ===
    if (linkedinToken && !email && !password && !googleToken && !phonenumber && !appleToken) {
      try {
        // 1. Fetch LinkedIn profile
        const profileRes = await axios.get("https://api.linkedin.com/v2/me", {
          headers: { Authorization: `Bearer ${linkedinToken}` }
        });

        // 2. Fetch LinkedIn email
        const emailRes = await axios.get(
          "https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))",
          {
            headers: { Authorization: `Bearer ${linkedinToken}` }
          }
        );

        const firstname = profileRes.data.localizedFirstName || "LinkedIn";
        const lastname = profileRes.data.localizedLastName || "User";
        const email = emailRes.data.elements[0]["handle~"].emailAddress;

        let user = await User.findOne({ email });
        let isFirstTime = false;

        if (!user) {
          isFirstTime = true;
          const serialNumber = await getNextSerialNumber();

          const { qrCode } = await generateUserQRCode(firstname, serialNumber, {
            firstname,
            lastname,
            email,
            provider: "linkedin"
          });

          user = await User.create({
            email,
            firstname,
            lastname,
            provider: "linkedin",
            serialNumber,
            qrCode,
            signupMethod: "linkedin",
            isVerified: true
          });
        }

        const token = createTokenforUser(user);

        return res.json({
          status: "success",
          message: "LinkedIn login successful",
          data: {
            token,
            registeredWith: user.signupMethod,
            isFirstTime
          }
        });
      } catch (err) {
        console.error("LinkedIn Login Error:", err?.response?.data || err);
        return res.status(500).json({
          status: "error",
          message: "LinkedIn login failed",
          error: err.message
        });
      }
    }

    return res.status(400).json({ status: "error", message: "Invalid login request" });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Login failed" });
  }
};


const startGoogleLogin = (req, res) => {
  const scopes = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes
  });

  return res.json({
    status: "success",
    message: "Google OAuth URL generated",
    url: url
  });
};

const googleCallback = async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ status: 'error', message: 'Missing authorization code' });
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({
      auth: oauth2Client,
      version: 'v2'
    });

    const { data } = await oauth2.userinfo.get();
    const { email, given_name, family_name } = data;

    let user = await User.findOne({ email });
    let isFirstTime = false;

    if (!user) {
      isFirstTime = true;
      const serialNumber = await getNextSerialNumber();
      const firstname = given_name || "Google";
      const lastname = family_name || "User";

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
        qrCode,
        signupMethod: "google",
        isVerified: true,
      });
    }

    const token = createTokenforUser(user);

    // ✅ Redirect based on whether it's first time
    // return res.json({
    //   status: 'success',
    //   message: 'Google login successful',

    // });

    const resultData = {
      status: 'success',
      message: 'Google connected successfully',
      data: {
        token: token,
        isFirstTime: isFirstTime
      }
    };

    console.log(resultData);


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
    return res.send(`
            <script>
                window.opener.postMessage({ status: 'error', message: 'Google login callback failed', error: '${error.message}' }, '*');
                window.close();
            </script>
        `);
  }
};

const startLinkedInLogin = (req, res) => {
  const scope = ['openid', 'profile', 'email'].join(' ');
  const authUrl = 'https://www.linkedin.com/oauth/v2/authorization?' + querystring.stringify({
    response_type: 'code',
    client_id: process.env.LINKEDIN_CLIENT_ID,
    redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
    scope: scope,
    state: 'linkedin_login_' + Date.now()
  });

  console.log(process.env.LINKEDIN_CLIENT_ID);


  return res.json({
    status: "success",
    message: "LinkedIn OAuth URL generated",
    url: authUrl
  });
};

const linkedinCallback = async (req, res) => {
  const { code } = req.query;

  console.log("LinkedIn Callback Code:", code);

  if (!code) {
    return res.status(400).json({ status: 'error', message: 'Missing authorization code' });
  }

  try {
    // 1. Exchange code for access token
    const tokenRes = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', querystring.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
      client_id: process.env.LINKEDIN_CLIENT_ID,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const accessToken = tokenRes.data.access_token;

    // 2. Get user profile (name)
    const userInfoRes = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const firstname = userInfoRes.data.given_name || 'LinkedIn';
    const lastname = userInfoRes.data.family_name || 'User';
    const email = userInfoRes.data.email || 'unknown@example.com';


    // const firstname = profileRes.data.localizedFirstName || "LinkedIn";
    // const lastname = profileRes.data.localizedLastName || "User";
    // const email = emailRes.data.elements[0]['handle~'].emailAddress;

    let user = await User.findOne({ email });
    let isFirstTime = false;

    if (!user) {
      isFirstTime = true;
      const serialNumber = await getNextSerialNumber();

      const { qrCode } = await generateUserQRCode(firstname, serialNumber, {
        firstname,
        lastname,
        email,
        provider: "linkedin"
      });

      user = await User.create({
        email,
        firstname,
        lastname,
        provider: "linkedin",
        serialNumber,
        qrCode,
        signupMethod: "linkedin",
        isVerified: true
      });
    }

    const token = createTokenforUser(user);

    const resultData = {
      status: 'success',
      message: 'LinkedIn connected successfully',
      data: {
        token: token,
        isFirstTime: isFirstTime
      }
    };

    console.log(resultData);
    

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
    console.error('LinkedIn Callback Error:', error.response?.data || error.message);
    return res.send(`
      <script>
        window.opener.postMessage({ status: 'error', message: 'LinkedIn login failed', error: '${error.message}' }, '*');
        window.close();
      </script>
    `);
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
  linkedinCallback
};
