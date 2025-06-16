const User = require("../models/userModel");

// @desc Scan QR and save data
// @route POST /api/scan
exports.scanUser = async (req, res) => {
    const { UserID, ScannerID } = req.body; // UserID = logged-in scanner, ScannerID = target being scanned

    try {
        const user = await User.findById(UserID);         // the one who scanned
        const scannedUser = await User.findById(ScannerID); // the one being scanned

        if (!user || !scannedUser) {
            return res.status(404).json({ status: "error", message: "User not found" });
        }

        // Initialize fields if not present
        if (!Array.isArray(user.iScanned)) user.iScanned = [];
        if (!Array.isArray(scannedUser.scannedMe)) scannedUser.scannedMe = [];

        let updated = false;

        // Add scanned user to iScanned list
        if (!user.iScanned.includes(ScannerID)) {
            user.iScanned.push(ScannerID);
            updated = true;
        }

        // Add current user to scannedMe list of scanned user
        if (!scannedUser.scannedMe.includes(UserID)) {
            scannedUser.scannedMe.push(UserID);
            updated = true;
        }

        if (updated) {
            await user.save();
            await scannedUser.save();
        }

        res.status(200).json({
            status: "success",
            message: "Scan successful",
            data: {
                iScanned: user.iScanned,
                scannedMe: scannedUser.scannedMe,
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: "Scan error" });
    }
};



// exports.getScanData = async (req, res) => {
//     const userId = req.user._id;

//     try {
//         const user = await User.findById(userId)
//             .populate("iScanned", "firstname lastname email profileImageURL")
//             .populate("scannedMe", "firstname lastname email profileImageURL");

//         if (!user) {
//             return res.status(404).json({ status: "error", message: "User not found" });
//         }

//         const iScannedUsers = user.iScanned.map((scannedUser) => ({
//             id: scannedUser._id,
//             firstname: scannedUser.firstname,
//             lastname: scannedUser.lastname,
//             email: scannedUser.email,
//             phonenumbers: scannedUser.phonenumbers,
//             profileImageURL: scannedUser.profileImageURL,
//             iScanned: true,
//         }));
//         console.log(iScannedUsers);

//         const scannedMeUsers = user.scannedMe
//             .filter(u => !user.iScanned.some(scanned => scanned._id.equals(u._id))) // avoid duplicates
//             .map((scannedByUser) => ({
//                 id: scannedByUser._id,
//                 firstname: scannedByUser.firstname,
//                 lastname: scannedByUser.lastname,
//                 email: scannedByUser.email,
//                 phonenumbers: scannedUser.phonenumbers,
//                 profileImageURL: scannedByUser.profileImageURL,
//                 iScanned: false,
//             }));

//         const combined = [...iScannedUsers, ...scannedMeUsers];

//         return res.status(200).json({
//             status: "success",
//             message: "Scan data fetched",
//             data: combined,
//         });
//     } catch (err) {
//         console.error(err);
//         return res.status(500).json({ status: "error", message: "Failed to fetch scan data" });
//     }
// };


exports.getScanData = async (req, res) => {
    const userId = req.user._id;

    try {
        const user = await User.findById(userId)
            .populate("iScanned", "firstname lastname email profileImageURL phonenumbers")
            .populate("scannedMe", "firstname lastname email profileImageURL phonenumbers");

        if (!user) {
            return res.status(404).json({ status: "error", message: "User not found" });
        }

        const iScannedUsers = user.iScanned.map((scannedUser) => ({
            id: scannedUser._id,
            firstname: scannedUser.firstname,
            lastname: scannedUser.lastname,
            email: scannedUser.email,
            phonenumbers: scannedUser.phonenumbers,
            profileImageURL: scannedUser.profileImageURL,
            iScanned: true,
        }));

        const scannedMeUsers = user.scannedMe
            .filter(u => !user.iScanned.some(scanned => scanned._id.equals(u._id))) // avoid duplicates
            .map((scannedByUser) => ({
                id: scannedByUser._id,
                firstname: scannedByUser.firstname,
                lastname: scannedByUser.lastname,
                email: scannedByUser.email,
                phonenumbers: scannedByUser.phonenumbers,
                profileImageURL: scannedByUser.profileImageURL,
                iScanned: false,
            }));

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

