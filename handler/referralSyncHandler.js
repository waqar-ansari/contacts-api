require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/userModel"); // Adjust path

const MONGO_URI = process.env.MONGO_URI; // Use AWS Lambda environment variable

// Main Lambda handler function
exports.handler = async (event) => {
    console.log("🔁 Running referral sync cron...");

    try {
        // Connect to MongoDB (only if not already connected)
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(MONGO_URI, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
            });
        }

        const users = await User.find({ referredBy: { $exists: true, $ne: null } });

        for (const user of users) {
            const referredById = user.referredBy;
            const referrer = await User.findById(referredById);

            if (!referrer) continue;

            const existingReferralIndex = referrer.myReferrals.findIndex(
                (ref) => ref._id.toString() === user._id.toString()
            );

            const updatedReferralData = {
                _id: user._id,
                firstname: user.firstname || "",
                lastname: user.lastname || "",
                email: user.email || "",
                phonenumbers: user.phonenumbers || [],
                signupDate: user.createdAt,
            };

            if (existingReferralIndex === -1) {
                referrer.myReferrals.push(updatedReferralData);
                console.log(`➕ Added new referral for user ${referrer._id}`);
            } else {
                const current = referrer.myReferrals[existingReferralIndex];
                const hasChanged =
                    current.firstname !== updatedReferralData.firstname ||
                    current.lastname !== updatedReferralData.lastname ||
                    current.email !== updatedReferralData.email ||
                    JSON.stringify(current.phonenumbers) !== JSON.stringify(updatedReferralData.phonenumbers) ||
                    new Date(current.signupDate).toISOString() !== new Date(updatedReferralData.signupDate).toISOString();

                if (hasChanged) {
                    referrer.myReferrals[existingReferralIndex] = updatedReferralData;
                    console.log(`🔁 Updated referral for user ${referrer._id}`);
                }
            }

            await referrer.save();
        }

        console.log("✅ Referral sync cron completed.");
        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Referral sync completed" }),
        };
    } catch (error) {
        console.error("❌ Referral sync cron failed:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    } finally {
        // Optional: Close DB connection if needed
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
    }
};