const User = require("../models/userModel");
const Contact = require("../models/contactModel"); // adjust the path as needed
const { mongoose } = require("mongoose");



// @desc Scan QR and save data
// @route POST /api/scan

exports.scanUser = async (req, res) => {
    const { UserID, ScannerID, firstname, lastname, email, phonenumber } = req.body;

    try {
        // Get the user who is being scanned
        const user = await User.findById(UserID); // QR code owner

        if (!user) {
            return res.status(404).json({ status: "error", message: "Scanned user (UserID) not found" });
        }

        if (!Array.isArray(user.scannedMe)) user.scannedMe = [];

        let updated = false;

        if (ScannerID) {
            // Case 1: Scanner is a registered user
            const scanner = await User.findById(ScannerID);

            if (!scanner) {
                return res.status(404).json({ status: "error", message: "Scanner (ScannerID) not found" });
            }

            if (!Array.isArray(scanner.iScanned)) scanner.iScanned = [];

            // // Add ScannerID into scanned user's scannedMe (if not already present)
            // if (!user.scannedMe.includes(ScannerID)) {
            //     user.scannedMe.push(ScannerID);
            //     updated = true;
            // }

            // // Add UserID into scanner's iScanned (if not already present)
            // if (!scanner.iScanned.includes(UserID)) {
            //     scanner.iScanned.push(UserID);
            //     await scanner.save(); // Save scanner's update
            // }

            // Add Scanner full info into scanned user's scannedMe
            const alreadyScanned = user.scannedMe.some(entry =>
                typeof entry === 'object' && entry._id?.toString() === scanner._id.toString()
            );

            if (!alreadyScanned) {
                user.scannedMe.push({
                    _id: scanner._id,
                    firstname: scanner.firstname || '',
                    lastname: scanner.lastname || '',
                    email: scanner.email || '',
                    phonenumber: Array.isArray(scanner.phonenumbers) ? scanner.phonenumbers[0] || '' : '',
                    linkedin: scanner.linkedin || '',
                    instagram: scanner.instagram || '',
                    telegram: scanner.telegram || '',
                    twitter: scanner.twitter || '',
                    facebook: scanner.facebook || '',
                    createdAt: new Date()
                });
                updated = true;

                const contactExists = await Contact.findOne({
                    createdBy: user._id,
                    $or: [
                        { emailaddresses: { $in: [scanner.email] } },
                        { phonenumbers: { $in: [scanner.phonenumbers[0]] } }
                    ]
                });

                if (!contactExists) {
                    await Contact.create({
                        contact_id: new mongoose.Types.ObjectId(), // ✅ make sure to include this!
                        firstname: scanner.firstname || '',
                        lastname: scanner.lastname || '',
                        emailaddresses: [scanner.email || ''],
                        phonenumbers: Array.isArray(scanner.phonenumbers) ? [scanner.phonenumbers[0]] : [],
                        linkedin: scanner.linkedin || '',
                        instagram: scanner.instagram || '',
                        telegram: scanner.telegram || '',
                        twitter: scanner.twitter || '',
                        facebook: scanner.facebook || '',
                        createdBy: user._id,
                    });
                }
            }

            // Add User full info into scanner's iScanned
            const alreadyInIScanned = scanner.iScanned.some(entry =>
                typeof entry === 'object' && entry._id?.toString() === user._id.toString()
            );

            if (!alreadyInIScanned) {
                scanner.iScanned.push({
                    _id: user._id,
                    firstname: user.firstname || '',
                    lastname: user.lastname || '',
                    email: user.email || '',
                    phonenumber: Array.isArray(user.phonenumbers) ? user.phonenumbers[0] || '' : '',
                    linkedin: user.linkedin || '',
                    instagram: user.instagram || '',
                    telegram: user.telegram || '',
                    twitter: user.twitter || '',
                    facebook: user.facebook || '',
                    createdAt: new Date()
                });
                await scanner.save(); // Save scanner updates
            }


        } else {
            // Case 2: Scanner is not registered — store temp data in scannedMe
            const alreadyExists = user.scannedMe.some(entry =>
                typeof entry === 'object' &&
                (entry.email === email || entry.phonenumber === phonenumber)
            );

            if (!alreadyExists) {
                user.scannedMe.push({
                    firstname: firstname || '',
                    lastname: lastname || '',
                    email: email || '',
                    phonenumber: phonenumber || '',
                    createdAt: new Date()
                });
                updated = true;
                const contactExists = await Contact.findOne({
                    createdBy: user._id,
                    $or: [
                        { emailaddresses: { $in: [email] } },
                        { phonenumbers: { $in: [phonenumber] } }
                    ]
                });

                if (!contactExists) {
                    await Contact.create({
                        contact_id: new mongoose.Types.ObjectId(), // ✅ make sure to include this!
                        firstname: firstname || '',
                        lastname: lastname || '',
                        emailaddresses: [email || ''],
                        phonenumbers: [phonenumber || ''],
                        createdBy: user._id,
                    });
                }
            }
        }

        if (updated) await user.save();

        return res.status(200).json({
            status: "success",
            message: "Scan successful",
            data: {
                scannedMe: user.scannedMe
            }
        });

    } catch (error) {
        console.error("Scan error:", error);
        return res.status(500).json({ status: "error", message: "Scan error", error: error.message });
    }
};



