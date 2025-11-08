const crypto = require('crypto');
const User = require('../models/userModel');
const sendWhatsAppOtp = require('../utils/sendWhatsAppOtp'); // ✅ Assuming you already have this

// // Step 1: Request OTP for Forgot Password
// exports.forgotPasswordPhone = async (req, res) => {
//     const { phonenumber, countryCode, apiType } = req.body;

//     try {
//         // Validation depending on apiType
//         if (apiType === "mobile") {
//             if (!phonenumber || !countryCode) {
//                 return res.status(400).json({ status: "error", message: "Phone number and countryCode are required for mobile" });
//             }
//         } else {
//             // web (or missing apiType) expects a full phone string (with country code)
//             if (!phonenumber) {
//                 return res.status(400).json({ status: "error", message: "Phone number is required" });
//             }
//         }

//         let sanitizedCountryCode;
//         let sanitizedPhone;
//         // Handle mobile: straightforward sanitization
//         if (apiType === "mobile") {
//             sanitizedPhone = phonenumber.replace(/[^0-9]/g, "");
//             sanitizedCountryCode = (countryCode || "").replace(/^\+/, "").replace(/[^0-9]/g, "");
//         } else {
//             // Handle web: single full number (e.g. "+919876543210" or "919876543210" or "00919876543210")
//             let sanitizedFull = (phonenumber || "").replace(/[^0-9]/g, "");
//             // remove international "00" prefix if present
//             sanitizedFull = sanitizedFull.replace(/^00/, "");
//             // try country code lengths 1..3 (E.164 country codes are 1-3 digits)
//             let found = null;
//             for (let len = 1; len <= 3; len++) {
//                 const cc = sanitizedFull.slice(0, len);
//                 const num = sanitizedFull.slice(len);
//                 if (!num) continue;
//                 /* try to find a user with this split */
//                 const u = await User.findOne({
//                     phonenumbers: {
//                         $elemMatch: {
//                             countryCode: cc,
//                             number: num,
//                         },
//                     },
//                     isVerified: true,
//                 });
//                 if (u) {
//                     found = { user: u, cc, num };
//                     break;
//                 }
//             }

//             if (!found) {
//                 // Not found with simple cc splits -> fallback: try to find any user where
//                 // phonenumbers.number equals the full string (in case you store full in number field)
//                 const uFallback = await User.findOne({
//                     "phonenumbers.number": sanitizedFull,
//                     isVerified: true,
//                 });
//                 if (uFallback) {
//                     // assume countryCode is stored separately — try to pick the first stored cc
//                     const firstPhone = (uFallback.phonenumbers && uFallback.phonenumbers[0]) || {};
//                     sanitizedCountryCode = firstPhone.countryCode || "";
//                     sanitizedPhone = sanitizedFull;
//                     user = uFallback;
//                 } else {
//                     return res.status(404).json({ status: "error", message: "User with this phone number not found or not verified" });
//                 }
//             } else {
//                 sanitizedCountryCode = found.cc;
//                 sanitizedPhone = found.num;
//                 user = found.user;
//             }
//         }

//         // If user wasn't found in the web-branch 'found' logic, try to find for mobile branch now
//         if (!user) {
//             user = await User.findOne({
//                 phonenumbers: {
//                     $elemMatch: {
//                         countryCode: sanitizedCountryCode,
//                         number: sanitizedPhone,
//                     },
//                 },
//                 isVerified: true,
//             });
//         }

//         if (!user) {
//             return res.status(404).json({ status: "error", message: "User with this phone number not found or not verified" });
//         }

//         // Generate OTP
//         const otp = Math.floor(100000 + Math.random() * 900000).toString();
//         const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

//         user.otp = otp;
//         user.otpExpiresAt = otpExpiresAt;
//         await user.save();

//         // send WhatsApp OTP (use the final sanitized country + number)
//         try {
//             await sendWhatsAppOtp(`+${sanitizedCountryCode}${sanitizedPhone}`, otp);
//         } catch (error) {
//             console.error("OTP Send Failed", error.response?.data || error.message);
//             return res.status(500).json({
//                 status: "error",
//                 message: "Failed to send OTP on WhatsApp",
//                 error: error.response?.data || error.message,
//             });
//         }

//         return res.json({
//             status: "success",
//             message: "OTP Sent in Whatsapp",
//         });
//     } catch (err) {
//         console.error("Forgot Password Phone Error", err);
//         return res.status(500).json({ status: "error", message: "Server error", error: err.message });
//     }
// };

// Step 1: Request OTP for Forgot Password
exports.forgotPasswordPhone = async (req, res) => {
    const { phonenumber, countryCode, apiType } = req.body;

    try {
        if (apiType === "mobile") {
            if (!phonenumber || !countryCode) {
                return res.status(400).json({
                    status: "error",
                    message: "Phone number and countryCode are required for mobile",
                });
            }
        } else {
            if (!phonenumber) {
                return res.status(400).json({
                    status: "error",
                    message: "Phone number is required",
                });
            }
        }

        let sanitizedCountryCode;
        let sanitizedPhone;
        let user = null;

        // 🧹 Sanitize and find user (same as your existing logic)
        if (apiType === "mobile") {
            sanitizedPhone = phonenumber.replace(/[^0-9]/g, "");
            sanitizedCountryCode = (countryCode || "").replace(/^\+/, "").replace(/[^0-9]/g, "");
        } else {
            let sanitizedFull = (phonenumber || "").replace(/[^0-9]/g, "");
            sanitizedFull = sanitizedFull.replace(/^00/, "");
            let found = null;

            for (let len = 1; len <= 3; len++) {
                const cc = sanitizedFull.slice(0, len);
                const num = sanitizedFull.slice(len);
                if (!num) continue;

                const u = await User.findOne({
                    phonenumbers: { $elemMatch: { countryCode: cc, number: num } },
                    isVerified: true,
                });

                if (u) {
                    found = { user: u, cc, num };
                    break;
                }
            }

            if (found) {
                sanitizedCountryCode = found.cc;
                sanitizedPhone = found.num;
                user = found.user;
            } else {
                const uFallback = await User.findOne({
                    "phonenumbers.number": sanitizedFull,
                    isVerified: true,
                });

                if (uFallback) {
                    const firstPhone = (uFallback.phonenumbers && uFallback.phonenumbers[0]) || {};
                    sanitizedCountryCode = firstPhone.countryCode || "";
                    sanitizedPhone = sanitizedFull;
                    user = uFallback;
                }
            }
        }

        // 🔍 Find user for mobile branch if not found
        if (!user) {
            user = await User.findOne({
                phonenumbers: {
                    $elemMatch: {
                        countryCode: sanitizedCountryCode,
                        number: sanitizedPhone,
                    },
                },
                isVerified: true,
            });
        }

        if (!user) {
            return res.status(404).json({
                status: "error",
                message: "User with this phone number not found or not verified",
            });
        }

        // 🚫 Check signup method
        if (user.signupMethod !== "phoneNumber") {
            return res.status(400).json({
                status: "error",
                message: `This account was created using ${user.signupMethod}. Please reset your password using ${user.signupMethod === "email" ? "email" : "that login method"}.`,
            });
        }

        // ✅ Generate OTP only for phone-based accounts
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

        user.otp = otp;
        user.otpExpiresAt = otpExpiresAt;
        await user.save();

        try {
            await sendWhatsAppOtp(`+${sanitizedCountryCode}${sanitizedPhone}`, otp);
        } catch (error) {
            console.error("OTP Send Failed", error.response?.data || error.message);
            return res.status(500).json({
                status: "error",
                message: "Failed to send OTP on WhatsApp",
                error: error.response?.data || error.message,
            });
        }

        return res.json({
            status: "success",
            message: "OTP sent on WhatsApp",
        });
    } catch (err) {
        console.error("Forgot Password Phone Error", err);
        return res.status(500).json({
            status: "error",
            message: "Server error",
            error: err.message,
        });
    }
};


// Step 2: Verify OTP and Reset Password
exports.resetPasswordPhone = async (req, res) => {
    const { phonenumber, countryCode, otp, password, confirmPassword, apiType } = req.body;

    try {
        if (!phonenumber || !otp || !password || !confirmPassword) {
            return res.status(400).json({
                status: "error",
                message: "Phone number, OTP, password, and confirm password are required",
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ status: "error", message: "Passwords do not match" });
        }

        let sanitizedCountryCode;
        let sanitizedPhone;
        let user = null;

        if (apiType === "mobile") {
            if (!countryCode) {
                return res.status(400).json({ status: "error", message: "countryCode is required for mobile apiType" });
            }
            sanitizedPhone = phonenumber.replace(/[^0-9]/g, "");
            sanitizedCountryCode = (countryCode || "").replace(/^\+/, "").replace(/[^0-9]/g, "");
            user = await User.findOne({
                phonenumbers: {
                    $elemMatch: {
                        countryCode: sanitizedCountryCode,
                        number: sanitizedPhone,
                    },
                },
            });
        } else {
            // web: phonenumber must be full (with country code)
            let sanitizedFull = (phonenumber || "").replace(/[^0-9]/g, "");
            sanitizedFull = sanitizedFull.replace(/^00/, "");
            for (let len = 1; len <= 3; len++) {
                const cc = sanitizedFull.slice(0, len);
                const num = sanitizedFull.slice(len);
                if (!num) continue;
                const u = await User.findOne({
                    phonenumbers: {
                        $elemMatch: {
                            countryCode: cc,
                            number: num,
                        },
                    },
                });
                if (u) {
                    user = u;
                    sanitizedCountryCode = cc;
                    sanitizedPhone = num;
                    break;
                }
            }
            if (!user) {
                // fallback: maybe you stored full number in number field
                const uFallback = await User.findOne({ "phonenumbers.number": sanitizedFull });
                if (uFallback) {
                    const firstPhone = (uFallback.phonenumbers && uFallback.phonenumbers[0]) || {};
                    sanitizedCountryCode = firstPhone.countryCode || "";
                    sanitizedPhone = sanitizedFull;
                    user = uFallback;
                }
            }
        }

        if (!user) {
            return res.status(400).json({
                status: "error",
                message: "Invalid phone number or user not found",
            });
        }

        // Validate OTP and expiry
        if (!user.otp || user.otp !== otp || !user.otpExpiresAt || user.otpExpiresAt < new Date()) {
            return res.status(400).json({
                status: "error",
                message: "Invalid or expired OTP",
            });
        }

        // Update password (ensure you have a pre-save hook to hash password, or hash here)
        user.password = password;
        // clear OTP fields
        user.otp = undefined;
        user.otpExpiresAt = undefined;

        await user.save();

        return res.json({
            status: "success",
            message: "Password Reset",
        });
    } catch (err) {
        console.error("Reset Password Phone Error", err);
        return res.status(500).json({ status: "error", message: "Server error", error: err.message });
    }
};
