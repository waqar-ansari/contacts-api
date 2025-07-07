const User = require("../models/userModel");
const Contact = require("../models/contactModel"); // adjust the path as needed
const { mongoose } = require("mongoose");

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
            const scanner = await User.findById(ScannerID);
            if (!scanner) {
                return res.status(404).json({ status: "error", message: "Scanner (ScannerID) not found" });
            }

            if (!Array.isArray(scanner.iScanned)) scanner.iScanned = [];
            if (!Array.isArray(scanner.scannedMe)) scanner.scannedMe = [];
            if (!Array.isArray(user.iScanned)) user.iScanned = [];
            if (!Array.isArray(user.scannedMe)) user.scannedMe = [];

            // ✅ MUTUAL CHECK: has scan already happened in either direction?
            const alreadyConnected = (
                user.scannedMe?.some(entry =>
                    typeof entry === 'object' && entry._id?.toString() === scanner._id.toString()
                ) ||
                scanner.scannedMe?.some(entry =>
                    typeof entry === 'object' && entry._id?.toString() === user._id.toString()
                ) ||
                user.iScanned?.some(entry =>
                    typeof entry === 'object' && entry._id?.toString() === scanner._id.toString()
                ) ||
                scanner.iScanned?.some(entry =>
                    typeof entry === 'object' && entry._id?.toString() === user._id.toString()
                )
            );

            if (alreadyConnected) {
                return res.status(400).json({
                    status: "error",
                    message: "Users already connected.",
                });
            }

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

                const contactExistsForScanner = await Contact.findOne({
                    createdBy: scanner._id,
                    $or: [
                        { emailaddresses: { $in: [user.email] } },
                        { phonenumbers: { $in: [user.phonenumbers[0]] } }
                    ]
                });

                if (!contactExistsForScanner) {
                    // const newContactIdForScanner = new mongoose.Types.ObjectId();

                    // await Contact.create({
                    //     _id: newContactIdForScanner,
                    //     contact_id: newContactIdForScanner,
                    //     firstname: user.firstname || '',
                    //     lastname: user.lastname || '',
                    //     emailaddresses: [user.email || ''],
                    //     // phonenumbers: Array.isArray(user.phonenumbers) ? [user.phonenumbers[0]] : [],
                    //     phonenumbers: Array.isArray(user.phonenumbers) && user.phonenumbers[0] ? [user.phonenumbers[0]] : [],
                    //     linkedin: user.linkedin || '',
                    //     instagram: user.instagram || '',
                    //     telegram: user.telegram || '',
                    //     twitter: user.twitter || '',
                    //     facebook: user.facebook || '',
                    //     createdBy: scanner._id,
                    // });

                    const newContact = new Contact({
                        firstname: user.firstname || '',
                        lastname: user.lastname || '',
                        emailaddresses: [user.email || ''],
                        phonenumbers: Array.isArray(user.phonenumbers) && user.phonenumbers[0] ? [user.phonenumbers[0]] : [],
                        linkedin: user.linkedin || '',
                        instagram: user.instagram || '',
                        telegram: user.telegram || '',
                        twitter: user.twitter || '',
                        facebook: user.facebook || '',
                        createdBy: scanner._id,
                    });
                    newContact.contact_id = newContact._id; // ensure consistency
                    await newContact.save();
                }

                // Second: Save contact in user's contacts (scanner info)
                const contactExistsForUser = await Contact.findOne({
                    createdBy: user._id,
                    $or: [
                        { emailaddresses: { $in: [scanner.email] } },
                        { phonenumbers: { $in: [scanner.phonenumbers[0]] } }
                    ]
                });

                if (!contactExistsForUser) {
                    // const newContactIdForUser = new mongoose.Types.ObjectId();

                    // await Contact.create({
                    //     _id: newContactIdForUser,
                    //     contact_id: newContactIdForUser,
                    //     firstname: scanner.firstname || '',
                    //     lastname: scanner.lastname || '',
                    //     emailaddresses: [scanner.email || ''],
                    //     // phonenumbers: Array.isArray(scanner.phonenumbers) ? [scanner.phonenumbers[0]] : [],
                    //     phonenumbers: Array.isArray(scanner.phonenumbers) && scanner.phonenumbers[0] ? [scanner.phonenumbers[0]] : [],
                    //     linkedin: scanner.linkedin || '',
                    //     instagram: scanner.instagram || '',
                    //     telegram: scanner.telegram || '',
                    //     twitter: scanner.twitter || '',
                    //     facebook: scanner.facebook || '',
                    //     createdBy: user._id,
                    // });

                    const newContact = new Contact({
                        firstname: scanner.firstname || '',
                        lastname: scanner.lastname || '',
                        emailaddresses: [scanner.email || ''],
                        phonenumbers: Array.isArray(scanner.phonenumbers) && scanner.phonenumbers[0] ? [scanner.phonenumbers[0]] : [],
                        linkedin: scanner.linkedin || '',
                        instagram: scanner.instagram || '',
                        telegram: scanner.telegram || '',
                        twitter: scanner.twitter || '',
                        facebook: scanner.facebook || '',
                        createdBy: user._id,
                    });
                    newContact.contact_id = newContact._id; // ensure consistency
                    await newContact.save();

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
                    phonenumber: (Array.isArray(user.phonenumbers) && user.phonenumbers.length > 0 && user.phonenumbers[0])
                        ? user.phonenumbers[0]
                        : '',
                    linkedin: user.linkedin || '',
                    instagram: user.instagram || '',
                    telegram: user.telegram || '',
                    twitter: user.twitter || '',
                    facebook: user.facebook || '',
                    createdAt: new Date()
                });
                await scanner.save(); // Save scanner updates
                // ✅ Add contact for scanner (based on iScanned only)
                const contactExistsForScanner = await Contact.findOne({
                    createdBy: scanner._id,
                    $or: [
                        { emailaddresses: { $in: [user.email] } },
                        { phonenumbers: { $in: [user.phonenumbers[0]] } }
                    ]
                });

                if (!contactExistsForScanner) {
                    // const newContactIdForScanner = new mongoose.Types.ObjectId();

                    // await Contact.create({
                    //     _id: newContactIdForScanner,
                    //     contact_id: newContactIdForScanner,
                    //     firstname: user.firstname || '',
                    //     lastname: user.lastname || '',
                    //     emailaddresses: [user.email || ''],
                    //     phonenumbers: Array.isArray(user.phonenumbers) && user.phonenumbers[0] ? [user.phonenumbers[0]] : [],
                    //     linkedin: user.linkedin || '',
                    //     instagram: user.instagram || '',
                    //     telegram: user.telegram || '',
                    //     twitter: user.twitter || '',
                    //     facebook: user.facebook || '',
                    //     createdBy: scanner._id,
                    // });

                    const newContact = new Contact({
                        firstname: user.firstname || '',
                        lastname: user.lastname || '',
                        emailaddresses: [user.email || ''],
                        phonenumbers: Array.isArray(user.phonenumbers) && user.phonenumbers[0] ? [user.phonenumbers[0]] : [],
                        linkedin: user.linkedin || '',
                        instagram: user.instagram || '',
                        telegram: user.telegram || '',
                        twitter: user.twitter || '',
                        facebook: user.facebook || '',
                        createdBy: scanner._id,
                    });
                    newContact.contact_id = newContact._id; // ensure consistency
                    await newContact.save();

                }
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
                    // await Contact.create({
                    //     contact_id: new mongoose.Types.ObjectId(), // ✅ make sure to include this!
                    //     firstname: firstname || '',
                    //     lastname: lastname || '',
                    //     emailaddresses: [email || ''],
                    //     phonenumbers: phonenumber ? [phonenumber] : [],
                    //     createdBy: user._id,
                    // });

                    const newContact = new Contact({
                        firstname: firstname || '',
                        lastname: lastname || '',
                        emailaddresses: [email || ''],
                        phonenumbers: phonenumber ? [phonenumber] : [],
                        createdBy: user._id,
                    });
                    newContact.contact_id = newContact._id; // ensure consistency
                    await newContact.save();

                }
            }
        }

        if (updated) await user.save();

        const responseData = {
            userScannedMe: user.scannedMe,
            userIScanned: user.iScanned || []
        };

        if (ScannerID) {
            const scanner = await User.findById(ScannerID).lean(); // get latest data
            responseData.scannerScannedMe = scanner?.scannedMe || [];
            responseData.scannerIScanned = scanner?.iScanned || [];
        }

        return res.status(200).json({
            status: "success",
            message: "Scan successful",
            data: responseData
        });
    } catch (error) {
        console.error("Scan error:", error);
        return res.status(500).json({ status: "error", message: "Scan error", error: error.message });
    }
};
