const Referral = require("../models/referralModel");
const crypto = require("crypto");
const cron = require("node-cron");
const User = require("../models/userModel");

const referFriend = async (req, res) => {
    const referredBy = req.user._id;

    // Generate referral code
    const referralCode = crypto.randomBytes(8).toString("hex");

    // Create referral entry with only referredBy and referralCode
    const referral = await Referral.create({
        referredBy,
        referralCode,
    });

    const referralUrl = `https://app.contacts.management/register?ref=${referralCode}`;

    return res.json({
        status: "success",
        message: "Referral link generated.",
        data: {
            referralUrl,
            referralCode,
        },
    });
};

const getReferredFriends = async (req, res) => {
    try {
        const referredBy = req.user._id;

        const referrals = await Referral.find({ referredBy })
            .populate("referredUserId", "firstname lastname email phonenumbers createdAt")
            .sort({ createdAt: -1 });

        return res.json({
            status: "success",
            message: "Referred friends fetched successfully.",
            data: referrals,
        });
    } catch (error) {
        console.error("Error fetching referred friends:", error);
        return res.status(500).json({
            status: "error",
            message: "Failed to fetch referred friends.",
        });
    }
};

module.exports = { referFriend, getReferredFriends };
