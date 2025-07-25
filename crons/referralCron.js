const cron = require("node-cron");
const User = require("../models/userModel"); // Adjust path as needed

cron.schedule("*/2 * * * *", async () => {
    // cron.schedule("0 2 * * *", async () => {
    console.log("🔁 Running referral sync cron...");

    try {
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
                // Add new referral
                referrer.myReferrals.push(updatedReferralData);
                console.log(`➕ Added new referral for user ${referrer._id}`);
            } else {
                // Update existing referral if changed
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
    } catch (error) {
        console.error("❌ Referral sync cron failed:", error);
    }
}, {
    scheduled: true,
    recoverMissedExecutions: true,
});
