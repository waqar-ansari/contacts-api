const crypto = require('crypto');
const User = require('../models/userModel');
const sendWhatsAppOtp = require('../utils/sendWhatsAppOtp'); // ✅ Assuming you already have this


// Step 1: Request OTP for Forgot Password
exports.forgotPasswordPhone = async (req, res) => {
    const { phonenumber, countryCode } = req.body;

    try {
        if (!phonenumber || !countryCode) {
            return res.status(400).json({ status: "error", message: "Phone number is required" });
        }

        // const sanitizedPhone = phonenumber.replace(/[^0-9]/g, "");
        // const user = await User.findOne({ phonenumbers: { $in: [sanitizedPhone] }, isVerified: true });

        const sanitizedPhone = phonenumber.replace(/[^0-9]/g, "");
        const sanitizedCountryCode = countryCode.replace(/^\+/, "");

        const user = await User.findOne({
            phonenumbers: {
                $elemMatch: {
                    countryCode: sanitizedCountryCode,
                    number: sanitizedPhone,
                },
            },
            isVerified: true,
        });


        if (!user) {
            return res.status(404).json({ status: "error", message: "User with this phone number not found or not verified" });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins validity

        user.otp = otp;
        user.otpExpiresAt = otpExpiresAt;
        await user.save();
        console.log(user.otp);
        try {
            await sendWhatsAppOtp(`+${sanitizedPhone}`, otp);
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
            message: "OTP sent to your WhatsApp number for password reset",
        });
    } catch (err) {
        console.error("Forgot Password Phone Error", err);
        return res.status(500).json({ status: "error", message: "Server error", error: err.message });
    }
};

// Step 2: Verify OTP and Reset Password
exports.resetPasswordPhone = async (req, res) => {
    const { phonenumber, countryCode, otp, password, confirmPassword } = req.body;

    try {
        if (!phonenumber || !otp || !password || !confirmPassword || !countryCode) {
            return res.status(400).json({
                status: "error",
                message: "Phone number, OTP, password, and confirm password are required",
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ status: "error", message: "Passwords do not match" });
        }

        // const sanitizedPhone = phonenumber.replace(/[^0-9]/g, "");
        // const user = await User.findOne({
        //     phonenumbers: { $in: [sanitizedPhone] },
        //     otp: otp,
        //     otpExpiresAt: { $gt: new Date() },
        // });

        const sanitizedPhone = phonenumber.replace(/[^0-9]/g, "");
        const sanitizedCountryCode = countryCode.replace(/^\+/, "");

        const user = await User.findOne({
            phonenumbers: {
                $elemMatch: {
                    countryCode: sanitizedCountryCode,
                    number: sanitizedPhone,
                },
            },
            otp: otp,
            otpExpiresAt: { $gt: new Date() },
        });


        if (!user) {
            return res.status(400).json({
                status: "error",
                message: "Invalid or expired OTP",
            });
        }

        // ✅ Update password
        user.password = password;
        user.resetOtp = undefined;
        user.resetOtpExpires = undefined;
        await user.save();

        return res.json({
            status: "success",
            message: "Password has been reset successfully",
        });
    } catch (err) {
        console.error("Reset Password Phone Error", err);
        return res.status(500).json({ status: "error", message: "Server error", error: err.message });
    }
};