const User = require("../models/userModel");

exports.getScanData = async (req, res) => {
    const userId = req.user._id;

    try {
        const user = await User.findById(userId)
            .populate({
                path: "iScanned",
                select: "firstname lastname email profileImageURL phonenumbers linkedin instagram telegram twitter facebook createdAt",
            })
            .lean(); // make it easier to manipulate data

        if (!user) {
            return res.status(404).json({ status: "error", message: "User not found" });
        }

        // STEP 1: Process iScanned
        const iScannedUsers = (user.iScanned || []).map(scannedUser => ({

            id: scannedUser._id || null,
            firstname: scannedUser.firstname || '',
            lastname: scannedUser.lastname || '',
            email: scannedUser.email || '',
            phonenumbers: Array.isArray(scannedUser.phonenumber)
                ? scannedUser.phonenumber
                : (scannedUser.phonenumber ? [scannedUser.phonenumber] : []),
            profileImageURL: scannedUser.profileImageURL || '',
            linkedin: scannedUser.linkedin || '',
            instagram: scannedUser.instagram || '',
            telegram: scannedUser.telegram || '',
            twitter: scannedUser.twitter || '',
            facebook: scannedUser.facebook || '',
            createdAt: scannedUser.createdAt,
            iScanned: true,
        }));

        // console.log(scannedUser.phonenumbers);


        // STEP 2: Process scannedMe
        const scannedMeEntries = user.scannedMe || [];
        const scannedMeUsers = [];

        for (const entry of scannedMeEntries) {
            if (typeof entry === "object" && entry._id && typeof entry._id === "object") {
                // This is an ObjectId ref to User — populate it manually
                const fullUser = await User.findById(entry._id)
                    .select("firstname lastname email profileImageURL phonenumbers  linkedin instagram telegram twitter facebook createdAt")
                    .lean();

                if (fullUser && !user.iScanned.some(u => u?._id?.toString() === fullUser._id.toString())) {
                    scannedMeUsers.push({
                        id: fullUser._id,
                        firstname: fullUser.firstname || '',
                        lastname: fullUser.lastname || '',
                        email: fullUser.email || '',
                        phonenumbers: Array.isArray(fullUser.phonenumbers)
                            ? fullUser.phonenumbers
                            : (fullUser.phonenumbers ? [fullUser.phonenumbers] : []),
                        profileImageURL: fullUser.profileImageURL || '',
                        linkedin: fullUser.linkedin || '',
                        instagram: fullUser.instagram || '',
                        telegram: fullUser.telegram || '',
                        twitter: fullUser.twitter || '',
                        facebook: fullUser.facebook || '',
                        createdAt: fullUser.createdAt,
                        iScanned: false,
                    });
                }
            } else if (typeof entry === "object") {
                // Temporary scanned user (not yet registered)
                scannedMeUsers.push({
                    id: null,
                    firstname: entry.firstname || '',
                    lastname: entry.lastname || '',
                    email: entry.email || '',
                    phonenumbers: Array.isArray(entry.phonenumber)
                        ? entry.phonenumber
                        : (entry.phonenumber ? [entry.phonenumber] : []),
                    linkedin: entry.linkedin || '',
                    instagram: entry.instagram || '',
                    telegram: entry.telegram || '',
                    twitter: entry.twitter || '',
                    facebook: entry.facebook || '',
                    createdAt: new Date(), // Use current date for temp entries
                    profileImageURL: '',
                    iScanned: false,
                });
            }
        }

        const combined = [...iScannedUsers, ...scannedMeUsers];

        return res.status(200).json({
            status: "success",
            message: "Scan data fetched",
            data: combined,
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ status: "error", message: "Failed to fetch scan data" });
    }
};
