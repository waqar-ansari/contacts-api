const User = require("../models/userModel");

const getMyReferrals = async (req, res) => {
    try {
        const currentUserId = req.user._id;
        const user = await User.findById(currentUserId).lean();

        if (!user) {
            return res.status(404).json({ status: "error", message: "User not found" });
        }

        if (!user.myReferrals || user.myReferrals.length === 0) {
            return res.status(200).json({ status: "success", message: "No referrals yet", data: [] });
        }

        const referralIds = user.myReferrals.map(entry => entry._id.toString());

        const referredUsers = await User.find({ _id: { $in: referralIds } }).lean();

        // Build a map for quick lookup
        const referredMap = {};
        referredUsers.forEach(ref => {
            referredMap[ref._id.toString()] = ref;
        });

        let needsUpdate = false;
        const updatedReferrals = user.myReferrals.map(entry => {
            const refUser = referredMap[entry._id.toString()];
            if (!refUser) return entry; // Skip if user not found

            const updatedEntry = { ...entry };
            let changed = false;

            if (!entry.firstname && refUser.firstname) {
                updatedEntry.firstname = refUser.firstname;
                changed = true;
            }

            if (!entry.lastname && refUser.lastname) {
                updatedEntry.lastname = refUser.lastname;
                changed = true;
            }

            if ((!entry.email || entry.email === "") && refUser.email) {
                updatedEntry.email = refUser.email;
                changed = true;
            }

            if ((!entry.phonenumbers || entry.phonenumbers.length === 0) && refUser.phonenumbers?.length) {
                updatedEntry.phonenumbers = refUser.phonenumbers;
                changed = true;
            }

            if (!entry.signupDate && refUser.createdAt) {
                updatedEntry.signupDate = refUser.createdAt;
                changed = true;
            }

            if (changed) {
                needsUpdate = true;
            }

            return updatedEntry;
        });

        // Only update in DB if there's a change
        if (needsUpdate) {
            await User.updateOne(
                { _id: currentUserId },
                { $set: { myReferrals: updatedReferrals } }
            );
        }

        return res.status(200).json({
            status: "success",
            message: "Referrals retrieved successfully",
            data: updatedReferrals,
        });

    } catch (err) {
        console.error("Get referrals error:", err.message);
        return res.status(500).json({
            status: "error",
            message: "Failed to retrieve referrals",
            error: err.message,
        });
    }
};

module.exports = {
    getMyReferrals,
};
