const User = require("../models/userModel");

// @desc Scan QR and save data
// @route POST /api/scan
exports.scanUser = async (req, res) => {
    const { ScannerID, UserID } = req.body;

    try {
        const scanner = await User.findById(ScannerID);
        const scanned = await User.findById(UserID);

        if (!scanner || !scanned) {
            return res.status(404).json({ status: "error", message: "User not found" });
        }

        // Ensure fields exist
        if (!scanner.iScanned) scanner.iScanned = [];
        if (!scanned.scannedMe) scanned.scannedMe = [];

        // Update relationships if not already added
        if (!scanner.iScanned.includes(UserID)) {
            scanner.iScanned.push(UserID);
            await scanner.save();
        }

        if (!scanned.scannedMe.includes(ScannerID)) {
            scanned.scannedMe.push(ScannerID);
            await scanned.save();
        }

        res.status(200).json({
            status: "success",
            message: "Scan successful",
            data: {
                iScanned: scanner.iScanned,
                scannedMe: scanner.scannedMe
            }

        });

    } catch (error) {
        res.status(500).json({ status: "error", message: "Scan error" });
    }
};


// @desc Get my scan data
// @route GET /api/scan/get_data
// exports.getScanData = async (req, res) => {
//     const userId = req.user._id;

//     try {
//         const user = await User.findById(userId)
//             .populate("iScanned", "firstname lastname email profileImageURL")
//             .populate("scannedMe", "firstname lastname email profileImageURL");

//         if (!user) return res.status(404).json({ status: "error", message: "User not found" });

//         res.json({
//             status: "success",
//             massage: "scanned data fetched",
//             data: {
//                 scannedMe: user.scannedMe,
//                 iScanned: user.iScanned,
//             }
//         });
//     } catch (err) {
//         return res.status(500).json({ status: "error", massage: "error to fetch data" });
//     }
// };

exports.getScanData = async (req, res) => {
    const userId = req.user._id;

    try {
        const user = await User.findById(userId)
            .populate("iScanned", "firstname lastname email profileImageURL")
            .populate("scannedMe", "firstname lastname email profileImageURL");

        if (!user) {
            return res.status(404).json({ status: "error", message: "User not found" });
        }

        const iScannedUsers = user.iScanned.map((user) => ({
            id: user._id,
            firstname: user.firstname,
            lastname: user.lastname,
            email: user.email,
            profileImageURL: user.profileImageURL,
            iScanned: true,
        }));

        const scannedMeUsers = user.scannedMe.map((user) => ({
            id: user._id,
            firstname: user.firstname,
            lastname: user.lastname,
            email: user.email,
            profileImageURL: user.profileImageURL,
            iScanned: false,
        }));

        const combined = [...iScannedUsers, ...scannedMeUsers];

        return res.json({
            status: "success",
            message: "Scan data fetched",
            data: combined,
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ status: "error", message: "Failed to fetch scan data" });
    }
};

