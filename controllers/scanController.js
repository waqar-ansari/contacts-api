// const User = require("../models/userModel");
// const Contact = require("../models/contactModel"); // adjust the path as needed
// const { mongoose } = require("mongoose");

// exports.scanUser = async (req, res) => {
//     const { UserID, ScannerID, firstname, lastname, email, phonenumber } = req.body;

//     try {
//         // Get the user who is being scanned
//         const user = await User.findById(UserID); // QR code owner

//         if (!user) {
//             return res.status(404).json({ status: "error", message: "Scanned user (UserID) not found" });
//         }

//         if (!Array.isArray(user.scannedMe)) user.scannedMe = [];

//         let updated = false;

//         if (ScannerID) {
//             const scanner = await User.findById(ScannerID);
//             if (!scanner) {
//                 return res.status(404).json({ status: "error", message: "Scanner (ScannerID) not found" });
//             }

//             if (!Array.isArray(scanner.iScanned)) scanner.iScanned = [];
//             if (!Array.isArray(scanner.scannedMe)) scanner.scannedMe = [];
//             if (!Array.isArray(user.iScanned)) user.iScanned = [];
//             if (!Array.isArray(user.scannedMe)) user.scannedMe = [];

//             // ✅ MUTUAL CHECK: has scan already happened in either direction?
//             const alreadyConnected = (
//                 user.scannedMe?.some(entry =>
//                     typeof entry === 'object' && entry._id?.toString() === scanner._id.toString()
//                 ) ||
//                 scanner.scannedMe?.some(entry =>
//                     typeof entry === 'object' && entry._id?.toString() === user._id.toString()
//                 ) ||
//                 user.iScanned?.some(entry =>
//                     typeof entry === 'object' && entry._id?.toString() === scanner._id.toString()
//                 ) ||
//                 scanner.iScanned?.some(entry =>
//                     typeof entry === 'object' && entry._id?.toString() === user._id.toString()
//                 )
//             );

//             if (alreadyConnected) {
//                 return res.status(400).json({
//                     status: "error",
//                     message: "Users already connected.",
//                 });
//             }

//             // Add Scanner full info into scanned user's scannedMe
//             const alreadyScanned = user.scannedMe.some(entry =>
//                 typeof entry === 'object' && entry._id?.toString() === scanner._id.toString()
//             );

//             if (!alreadyScanned) {
//                 user.scannedMe.push({
//                     _id: scanner._id,
//                     firstname: scanner.firstname || '',
//                     lastname: scanner.lastname || '',
//                     email: scanner.email || '',
//                     // phonenumber: Array.isArray(scanner.phonenumbers) ? scanner.phonenumbers[0] || '' : '',
//                     phonenumber: (Array.isArray(scanner.phonenumbers) && scanner.phonenumbers.length > 0)
//                         ? scanner.phonenumbers[0].number
//                         : '',
//                     countryCode: (Array.isArray(scanner.phonenumbers) && scanner.phonenumbers.length > 0)
//                         ? scanner.phonenumbers[0].countryCode
//                         : '',
//                     linkedin: scanner.linkedin || '',
//                     instagram: scanner.instagram || '',
//                     telegram: scanner.telegram || '',
//                     twitter: scanner.twitter || '',
//                     facebook: scanner.facebook || '',
//                     createdAt: new Date()
//                 });
//                 updated = true;

//                 const contactExistsForScanner = await Contact.findOne({
//                     createdBy: scanner._id,
//                     $or: [
//                         { emailaddresses: { $in: [user.email] } },
//                         { phonenumbers: { $in: [user.phonenumbers[0]] } }
//                     ]
//                 });

//                 if (!contactExistsForScanner) {
//                     // const newContactIdForScanner = new mongoose.Types.ObjectId();

//                     // await Contact.create({
//                     //     _id: newContactIdForScanner,
//                     //     contact_id: newContactIdForScanner,
//                     //     firstname: user.firstname || '',
//                     //     lastname: user.lastname || '',
//                     //     emailaddresses: [user.email || ''],
//                     //     // phonenumbers: Array.isArray(user.phonenumbers) ? [user.phonenumbers[0]] : [],
//                     //     phonenumbers: Array.isArray(user.phonenumbers) && user.phonenumbers[0] ? [user.phonenumbers[0]] : [],
//                     //     linkedin: user.linkedin || '',
//                     //     instagram: user.instagram || '',
//                     //     telegram: user.telegram || '',
//                     //     twitter: user.twitter || '',
//                     //     facebook: user.facebook || '',
//                     //     createdBy: scanner._id,
//                     // });

//                     const newContact = new Contact({
//                         firstname: user.firstname || '',
//                         lastname: user.lastname || '',
//                         emailaddresses: [user.email || ''],
//                         phonenumbers: Array.isArray(user.phonenumbers) && user.phonenumbers[0] ? [user.phonenumbers[0]] : [],
//                         linkedin: user.linkedin || '',
//                         instagram: user.instagram || '',
//                         telegram: user.telegram || '',
//                         twitter: user.twitter || '',
//                         facebook: user.facebook || '',
//                         createdBy: scanner._id,
//                     });
//                     newContact.contact_id = newContact._id; // ensure consistency
//                     await newContact.save();
//                 }

//                 // Second: Save contact in user's contacts (scanner info)
//                 const contactExistsForUser = await Contact.findOne({
//                     createdBy: user._id,
//                     $or: [
//                         { emailaddresses: { $in: [scanner.email] } },
//                         { phonenumbers: { $in: [scanner.phonenumbers[0]] } }
//                     ]
//                 });

//                 if (!contactExistsForUser) {
//                     // const newContactIdForUser = new mongoose.Types.ObjectId();

//                     // await Contact.create({
//                     //     _id: newContactIdForUser,
//                     //     contact_id: newContactIdForUser,
//                     //     firstname: scanner.firstname || '',
//                     //     lastname: scanner.lastname || '',
//                     //     emailaddresses: [scanner.email || ''],
//                     //     // phonenumbers: Array.isArray(scanner.phonenumbers) ? [scanner.phonenumbers[0]] : [],
//                     //     phonenumbers: Array.isArray(scanner.phonenumbers) && scanner.phonenumbers[0] ? [scanner.phonenumbers[0]] : [],
//                     //     linkedin: scanner.linkedin || '',
//                     //     instagram: scanner.instagram || '',
//                     //     telegram: scanner.telegram || '',
//                     //     twitter: scanner.twitter || '',
//                     //     facebook: scanner.facebook || '',
//                     //     createdBy: user._id,
//                     // });

//                     const newContact = new Contact({
//                         firstname: scanner.firstname || '',
//                         lastname: scanner.lastname || '',
//                         emailaddresses: [scanner.email || ''],
//                         phonenumbers: Array.isArray(scanner.phonenumbers) && scanner.phonenumbers[0] ? [scanner.phonenumbers[0]] : [],
//                         linkedin: scanner.linkedin || '',
//                         instagram: scanner.instagram || '',
//                         telegram: scanner.telegram || '',
//                         twitter: scanner.twitter || '',
//                         facebook: scanner.facebook || '',
//                         createdBy: user._id,
//                     });
//                     newContact.contact_id = newContact._id; // ensure consistency
//                     await newContact.save();

//                 }
//             }

//             // Add User full info into scanner's iScanned
//             const alreadyInIScanned = scanner.iScanned.some(entry =>
//                 typeof entry === 'object' && entry._id?.toString() === user._id.toString()
//             );

//             if (!alreadyInIScanned) {
//                 scanner.iScanned.push({
//                     _id: user._id,
//                     firstname: user.firstname || '',
//                     lastname: user.lastname || '',
//                     email: user.email || '',
//                     phonenumber: (Array.isArray(user.phonenumbers) && user.phonenumbers.length > 0 && user.phonenumbers[0])
//                         ? user.phonenumbers[0]
//                         : '',
//                     linkedin: user.linkedin || '',
//                     instagram: user.instagram || '',
//                     telegram: user.telegram || '',
//                     twitter: user.twitter || '',
//                     facebook: user.facebook || '',
//                     createdAt: new Date()
//                 });
//                 await scanner.save(); // Save scanner updates
//                 // ✅ Add contact for scanner (based on iScanned only)
//                 const contactExistsForScanner = await Contact.findOne({
//                     createdBy: scanner._id,
//                     $or: [
//                         { emailaddresses: { $in: [user.email] } },
//                         { phonenumbers: { $in: [user.phonenumbers[0]] } }
//                     ]
//                 });

//                 if (!contactExistsForScanner) {
//                     // const newContactIdForScanner = new mongoose.Types.ObjectId();

//                     // await Contact.create({
//                     //     _id: newContactIdForScanner,
//                     //     contact_id: newContactIdForScanner,
//                     //     firstname: user.firstname || '',
//                     //     lastname: user.lastname || '',
//                     //     emailaddresses: [user.email || ''],
//                     //     phonenumbers: Array.isArray(user.phonenumbers) && user.phonenumbers[0] ? [user.phonenumbers[0]] : [],
//                     //     linkedin: user.linkedin || '',
//                     //     instagram: user.instagram || '',
//                     //     telegram: user.telegram || '',
//                     //     twitter: user.twitter || '',
//                     //     facebook: user.facebook || '',
//                     //     createdBy: scanner._id,
//                     // });

//                     const newContact = new Contact({
//                         firstname: user.firstname || '',
//                         lastname: user.lastname || '',
//                         emailaddresses: [user.email || ''],
//                         phonenumbers: Array.isArray(user.phonenumbers) && user.phonenumbers[0] ? [user.phonenumbers[0]] : [],
//                         linkedin: user.linkedin || '',
//                         instagram: user.instagram || '',
//                         telegram: user.telegram || '',
//                         twitter: user.twitter || '',
//                         facebook: user.facebook || '',
//                         createdBy: scanner._id,
//                     });
//                     newContact.contact_id = newContact._id; // ensure consistency
//                     await newContact.save();

//                 }
//             }
//         }
//         // else {
//         //     // Case 2: Scanner is not registered — store temp data in scannedMe
//         //     const alreadyExists = user.scannedMe.some(entry =>
//         //         typeof entry === 'object' &&
//         //         (entry.email === email || entry.phonenumber === phonenumber)
//         //     );

//         //     if (!alreadyExists) {
//         //         user.scannedMe.push({
//         //             firstname: firstname || '',
//         //             lastname: lastname || '',
//         //             email: email || '',
//         //             phonenumber: phonenumber || '',
//         //             createdAt: new Date()
//         //         });
//         //         updated = true;
//         //         const contactExists = await Contact.findOne({
//         //             createdBy: user._id,
//         //             $or: [
//         //                 { emailaddresses: { $in: [email] } },
//         //                 { phonenumbers: { $in: [phonenumber] } }
//         //             ]
//         //         });

//         //         if (!contactExists) {
//         //             // await Contact.create({
//         //             //     contact_id: new mongoose.Types.ObjectId(), // ✅ make sure to include this!
//         //             //     firstname: firstname || '',
//         //             //     lastname: lastname || '',
//         //             //     emailaddresses: [email || ''],
//         //             //     phonenumbers: phonenumber ? [phonenumber] : [],
//         //             //     createdBy: user._id,
//         //             // });

//         //             const newContact = new Contact({
//         //                 firstname: firstname || '',
//         //                 lastname: lastname || '',
//         //                 emailaddresses: [email || ''],
//         //                 phonenumbers: phonenumber ? [phonenumber] : [],
//         //                 createdBy: user._id,
//         //             });
//         //             newContact.contact_id = newContact._id; // ensure consistency
//         //             await newContact.save();

//         //         }
//         //     }
//         // }
//         else {
//             // Case 2: Scanner is not registered — store temp data in scannedMe

//             // 🔹 Step 1: Try to match existing registered user with given email + phonenumber
//             let matchedScanner = null;

//             if (email && phonenumber) {
//                 // 1️⃣ Try both email + phone match
//                 matchedScanner = await User.findOne({
//                     email: email,
//                     phonenumbers: { $in: [phonenumber] }
//                 });

//                 // 2️⃣ If not found, try email only
//                 if (!matchedScanner) {
//                     matchedScanner = await User.findOne({ email: email });
//                 }

//                 // 3️⃣ If still not found, try phone only
//                 if (!matchedScanner) {
//                     matchedScanner = await User.findOne({ phonenumbers: { $in: [phonenumber] } });
//                 }
//             }
//             else if (email) {
//                 // 4️⃣ Only email provided
//                 matchedScanner = await User.findOne({ email: email });
//             }
//             else if (phonenumber) {
//                 // 5️⃣ Only phone provided
//                 matchedScanner = await User.findOne({ phonenumbers: { $in: [phonenumber] } });
//             }
//             console.log("Matched Scanner:", matchedScanner);

//             // if (matchedScanner) {
//             //     // ✅ Treat as registered scanner
//             //     const scanner = matchedScanner;

//             //     if (!Array.isArray(scanner.iScanned)) scanner.iScanned = [];
//             //     if (!Array.isArray(scanner.scannedMe)) scanner.scannedMe = [];
//             //     if (!Array.isArray(user.iScanned)) user.iScanned = [];
//             //     if (!Array.isArray(user.scannedMe)) user.scannedMe = [];

//             //     // Check already connected
//             //     const alreadyConnected = (
//             //         user.scannedMe?.some(entry => entry._id?.toString() === scanner._id.toString()) ||
//             //         user.iScanned?.some(entry => entry._id?.toString() === scanner._id.toString()) ||
//             //         scanner.scannedMe?.some(entry => entry._id?.toString() === user._id.toString()) ||
//             //         scanner.iScanned?.some(entry => entry._id?.toString() === user._id.toString())
//             //     );

//             //     if (!alreadyConnected) {
//             //         // Add to scannedMe
//             //         user.scannedMe.push({
//             //             _id: scanner._id,
//             //             firstname: scanner.firstname || '',
//             //             lastname: scanner.lastname || '',
//             //             email: scanner.email || '',
//             //             phonenumber: Array.isArray(scanner.phonenumbers) ? scanner.phonenumbers[0] || '' : '',
//             //             linkedin: scanner.linkedin || '',
//             //             instagram: scanner.instagram || '',
//             //             telegram: scanner.telegram || '',
//             //             twitter: scanner.twitter || '',
//             //             facebook: scanner.facebook || '',
//             //             createdAt: new Date()
//             //         });

//             //         // Add to iScanned
//             //         scanner.iScanned.push({
//             //             _id: user._id,
//             //             firstname: user.firstname || '',
//             //             lastname: user.lastname || '',
//             //             email: user.email || '',
//             //             phonenumber: Array.isArray(user.phonenumbers) ? user.phonenumbers[0] || '' : '',
//             //             linkedin: user.linkedin || '',
//             //             instagram: user.instagram || '',
//             //             telegram: user.telegram || '',
//             //             twitter: user.twitter || '',
//             //             facebook: user.facebook || '',
//             //             createdAt: new Date()
//             //         });

//             //         await scanner.save();
//             //         updated = true;
//             //     }
//             // } 
//             if (matchedScanner) {
//                 // ✅ Treat as registered scanner
//                 const scanner = matchedScanner;

//                 if (!Array.isArray(scanner.iScanned)) scanner.iScanned = [];
//                 if (!Array.isArray(scanner.scannedMe)) scanner.scannedMe = [];
//                 if (!Array.isArray(user.iScanned)) user.iScanned = [];
//                 if (!Array.isArray(user.scannedMe)) user.scannedMe = [];

//                 // Check already connected
//                 const alreadyConnected = (
//                     user.scannedMe?.some(entry => entry._id?.toString() === scanner._id.toString()) ||
//                     user.iScanned?.some(entry => entry._id?.toString() === scanner._id.toString()) ||
//                     scanner.scannedMe?.some(entry => entry._id?.toString() === user._id.toString()) ||
//                     scanner.iScanned?.some(entry => entry._id?.toString() === user._id.toString())
//                 );

//                 if (!alreadyConnected) {
//                     // Add to scannedMe
//                     user.scannedMe.push({
//                         _id: scanner._id,
//                         firstname: scanner.firstname || '',
//                         lastname: scanner.lastname || '',
//                         email: scanner.email || '',
//                         // phonenumber: Array.isArray(scanner.phonenumbers) ? scanner.phonenumbers[0] || '' : '',
//                         phonenumber: (Array.isArray(scanner.phonenumbers) && scanner.phonenumbers.length > 0)
//                             ? scanner.phonenumbers[0].number
//                             : '',
//                         countryCode: (Array.isArray(scanner.phonenumbers) && scanner.phonenumbers.length > 0)
//                             ? scanner.phonenumbers[0].countryCode
//                             : '',
//                         linkedin: scanner.linkedin || '',
//                         instagram: scanner.instagram || '',
//                         telegram: scanner.telegram || '',
//                         twitter: scanner.twitter || '',
//                         facebook: scanner.facebook || '',
//                         createdAt: new Date()
//                     });

//                     // Add to iScanned
//                     scanner.iScanned.push({
//                         _id: user._id,
//                         firstname: user.firstname || '',
//                         lastname: user.lastname || '',
//                         email: user.email || '',
//                         phonenumber: Array.isArray(user.phonenumbers) ? user.phonenumbers[0] || '' : '',
//                         linkedin: user.linkedin || '',
//                         instagram: user.instagram || '',
//                         telegram: user.telegram || '',
//                         twitter: user.twitter || '',
//                         facebook: user.facebook || '',
//                         createdAt: new Date()
//                     });

//                     // ✅ NEW: Create contact for UserID
//                     const contactExistsForUser = await Contact.findOne({
//                         createdBy: user._id,
//                         $or: [
//                             { emailaddresses: { $in: [scanner.email] } },
//                             { phonenumbers: { $in: [scanner.phonenumbers[0]] } }
//                         ]
//                     });
//                     if (!contactExistsForUser) {
//                         const newContact = new Contact({
//                             firstname: scanner.firstname || '',
//                             lastname: scanner.lastname || '',
//                             emailaddresses: [scanner.email || ''],
//                             phonenumbers: Array.isArray(scanner.phonenumbers) && scanner.phonenumbers[0] ? [scanner.phonenumbers[0]] : [],
//                             linkedin: scanner.linkedin || '',
//                             instagram: scanner.instagram || '',
//                             telegram: scanner.telegram || '',
//                             twitter: scanner.twitter || '',
//                             facebook: scanner.facebook || '',
//                             createdBy: user._id,
//                         });
//                         newContact.contact_id = newContact._id;
//                         await newContact.save();
//                     }

//                     // ✅ NEW: Create contact for Scanner
//                     const contactExistsForScanner = await Contact.findOne({
//                         createdBy: scanner._id,
//                         $or: [
//                             { emailaddresses: { $in: [user.email] } },
//                             { phonenumbers: { $in: [user.phonenumbers[0]] } }
//                         ]
//                     });
//                     if (!contactExistsForScanner) {
//                         const newContact = new Contact({
//                             firstname: user.firstname || '',
//                             lastname: user.lastname || '',
//                             emailaddresses: [user.email || ''],
//                             phonenumbers: Array.isArray(user.phonenumbers) && user.phonenumbers[0] ? [user.phonenumbers[0]] : [],
//                             linkedin: user.linkedin || '',
//                             instagram: user.instagram || '',
//                             telegram: user.telegram || '',
//                             twitter: user.twitter || '',
//                             facebook: user.facebook || '',
//                             createdBy: scanner._id,
//                         });
//                         newContact.contact_id = newContact._id;
//                         await newContact.save();
//                     }

//                     await scanner.save();
//                     updated = true;
//                 }
//             }

//             // else {
//             //     // 🔹 No registered user match → run your existing "unregistered scanner" logic
//             //     const alreadyExists = user.scannedMe.some(entry =>
//             //         typeof entry === 'object' &&
//             //         (entry.email === email || entry.phonenumber === phonenumber)
//             //     );

//             //     if (!alreadyExists) {
//             //         user.scannedMe.push({
//             //             firstname: firstname || '',
//             //             lastname: lastname || '',
//             //             email: email || '',
//             //             phonenumber: phonenumber || '',
//             //             createdAt: new Date()
//             //         });
//             //         updated = true;
//             //     }
//             // }
//             else {
//                 // 🔹 No registered user match → run your existing "unregistered scanner" logic
//                 const alreadyExists = user.scannedMe.some(entry =>
//                     typeof entry === 'object' &&
//                     (entry.email === email || entry.phonenumber === phonenumber)
//                 );

//                 if (!alreadyExists) {
//                     user.scannedMe.push({
//                         firstname: firstname || '',
//                         lastname: lastname || '',
//                         email: email || '',
//                         phonenumber: phonenumber || '',
//                         createdAt: new Date()
//                     });
//                     updated = true;

//                     // ✅ NEW: Create contact for UserID from temp data
//                     const contactExists = await Contact.findOne({
//                         createdBy: user._id,
//                         $or: [
//                             { emailaddresses: { $in: [email] } },
//                             { phonenumbers: { $in: [phonenumber] } }
//                         ]
//                     });
//                     if (!contactExists) {
//                         const newContact = new Contact({
//                             firstname: firstname || '',
//                             lastname: lastname || '',
//                             emailaddresses: [email || ''],
//                             phonenumbers: phonenumber ? [phonenumber] : [],
//                             createdBy: user._id,
//                         });
//                         newContact.contact_id = newContact._id;
//                         await newContact.save();
//                     }
//                 }
//             }
//         }


//         if (updated) await user.save();

//         const responseData = {
//             userScannedMe: user.scannedMe,
//             userIScanned: user.iScanned || []
//         };

//         if (ScannerID) {
//             const scanner = await User.findById(ScannerID).lean(); // get latest data
//             responseData.scannerScannedMe = scanner?.scannedMe || [];
//             responseData.scannerIScanned = scanner?.iScanned || [];
//         }

//         return res.status(200).json({
//             status: "success",
//             message: "Scan successful",
//             data: responseData
//         });
//     } catch (error) {
//         console.error("Scan error:", error);
//         return res.status(500).json({ status: "error", message: "Scan error", error: error.message });
//     }
// };

const User = require("../models/userModel");
const Contact = require("../models/contactModel"); // adjust the path as needed
const { mongoose } = require("mongoose");

exports.scanUser = async (req, res) => {
    // CHANGED: accept countryCode from body for unregistered scanner path
    const { UserID, ScannerID, firstname, lastname, email, phonenumber, countryCode } = req.body;

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
            const alreadyConnected =
                user.scannedMe?.some(
                    (entry) => typeof entry === "object" && entry._id?.toString() === scanner._id.toString()
                ) ||
                scanner.scannedMe?.some(
                    (entry) => typeof entry === "object" && entry._id?.toString() === user._id.toString()
                ) ||
                user.iScanned?.some(
                    (entry) => typeof entry === "object" && entry._id?.toString() === scanner._id.toString()
                ) ||
                scanner.iScanned?.some(
                    (entry) => typeof entry === "object" && entry._id?.toString() === user._id.toString()
                );

            if (alreadyConnected) {
                return res.status(400).json({
                    status: "error",
                    message: "Users already connected.",
                });
            }

            // Add Scanner full info into scanned user's scannedMe
            const alreadyScanned = user.scannedMe.some(
                (entry) => typeof entry === "object" && entry._id?.toString() === scanner._id.toString()
            );

            if (!alreadyScanned) {
                user.scannedMe.push({
                    _id: scanner._id,
                    firstname: scanner.firstname || "",
                    lastname: scanner.lastname || "",
                    email: scanner.email || "",
                    // CHANGED: read number + countryCode from scanner.phonenumbers[0]
                    phonenumber: scanner.phonenumbers?.[0]?.number || "",
                    countryCode: scanner.phonenumbers?.[0]?.countryCode || "",
                    linkedin: scanner.linkedin || "",
                    instagram: scanner.instagram || "",
                    telegram: scanner.telegram || "",
                    twitter: scanner.twitter || "",
                    facebook: scanner.facebook || "",
                    createdAt: new Date(),
                });
                updated = true;

                // CHANGED: Contact duplicate check → use $elemMatch for phone object
                const contactExistsForScanner = await Contact.findOne({
                    createdBy: scanner._id,
                    $or: [
                        { emailaddresses: { $in: [user.email] } },
                        user.phonenumbers?.[0]?.number
                            ? {
                                phonenumbers: {
                                    $elemMatch: {
                                        countryCode: user.phonenumbers?.[0]?.countryCode || "",
                                        number: user.phonenumbers?.[0]?.number || "",
                                    },
                                },
                            }
                            : { _id: null }, // no phone to match
                    ],
                });

                if (!contactExistsForScanner) {
                    const newContact = new Contact({
                        firstname: user.firstname || "",
                        lastname: user.lastname || "",
                        emailaddresses: [user.email || ""],
                        // CHANGED: save the whole phone object (if exists)
                        phonenumbers:
                            Array.isArray(user.phonenumbers) && user.phonenumbers[0]
                                ? [user.phonenumbers[0]]
                                : [],
                        linkedin: user.linkedin || "",
                        instagram: user.instagram || "",
                        telegram: user.telegram || "",
                        twitter: user.twitter || "",
                        facebook: user.facebook || "",
                        createdBy: scanner._id,
                    });
                    newContact.contact_id = newContact._id; // ensure consistency
                    await newContact.save();
                }

                // Second: Save contact in user's contacts (scanner info)
                // CHANGED: duplicate check uses $elemMatch
                const contactExistsForUser = await Contact.findOne({
                    createdBy: user._id,
                    $or: [
                        { emailaddresses: { $in: [scanner.email] } },
                        scanner.phonenumbers?.[0]?.number
                            ? {
                                phonenumbers: {
                                    $elemMatch: {
                                        countryCode: scanner.phonenumbers?.[0]?.countryCode || "",
                                        number: scanner.phonenumbers?.[0]?.number || "",
                                    },
                                },
                            }
                            : { _id: null },
                    ],
                });

                if (!contactExistsForUser) {
                    const newContact = new Contact({
                        firstname: scanner.firstname || "",
                        lastname: scanner.lastname || "",
                        emailaddresses: [scanner.email || ""],
                        // CHANGED: save whole object
                        phonenumbers:
                            Array.isArray(scanner.phonenumbers) && scanner.phonenumbers[0]
                                ? [scanner.phonenumbers[0]]
                                : [],
                        linkedin: scanner.linkedin || "",
                        instagram: scanner.instagram || "",
                        telegram: scanner.telegram || "",
                        twitter: scanner.twitter || "",
                        facebook: scanner.facebook || "",
                        createdBy: user._id,
                    });
                    newContact.contact_id = newContact._id; // ensure consistency
                    await newContact.save();
                }
            }

            // Add User full info into scanner's iScanned
            const alreadyInIScanned = scanner.iScanned.some(
                (entry) => typeof entry === "object" && entry._id?.toString() === user._id.toString()
            );

            if (!alreadyInIScanned) {
                scanner.iScanned.push({
                    _id: user._id,
                    firstname: user.firstname || "",
                    lastname: user.lastname || "",
                    email: user.email || "",
                    // CHANGED: store number + countryCode as sibling fields (consistent with scannedMe)
                    phonenumber: user.phonenumbers?.[0]?.number || "",
                    countryCode: user.phonenumbers?.[0]?.countryCode || "",
                    linkedin: user.linkedin || "",
                    instagram: user.instagram || "",
                    telegram: user.telegram || "",
                    twitter: user.twitter || "",
                    facebook: user.facebook || "",
                    createdAt: new Date(),
                });
                await scanner.save(); // Save scanner updates

                // ✅ Add contact for scanner (based on iScanned only)
                // CHANGED: duplicate check uses $elemMatch
                const contactExistsForScanner2 = await Contact.findOne({
                    createdBy: scanner._id,
                    $or: [
                        { emailaddresses: { $in: [user.email] } },
                        user.phonenumbers?.[0]?.number
                            ? {
                                phonenumbers: {
                                    $elemMatch: {
                                        countryCode: user.phonenumbers?.[0]?.countryCode || "",
                                        number: user.phonenumbers?.[0]?.number || "",
                                    },
                                },
                            }
                            : { _id: null },
                    ],
                });

                if (!contactExistsForScanner2) {
                    const newContact = new Contact({
                        firstname: user.firstname || "",
                        lastname: user.lastname || "",
                        emailaddresses: [user.email || ""],
                        phonenumbers:
                            Array.isArray(user.phonenumbers) && user.phonenumbers[0]
                                ? [user.phonenumbers[0]]
                                : [],
                        linkedin: user.linkedin || "",
                        instagram: user.instagram || "",
                        telegram: user.telegram || "",
                        twitter: user.twitter || "",
                        facebook: user.facebook || "",
                        createdBy: scanner._id,
                    });
                    newContact.contact_id = newContact._id; // ensure consistency
                    await newContact.save();
                }
            }
        } else {
            // Case 2: Scanner is not registered — store temp data in scannedMe

            // 🔹 Step 1: Try to match existing registered user with given email + phonenumber
            let matchedScanner = null;

            if (email && phonenumber) {
                // 1️⃣ Try both email + phone match (CHANGED for phone schema)
                matchedScanner = await User.findOne(
                    countryCode
                        ? {
                            email: email,
                            phonenumbers: { $elemMatch: { countryCode, number: phonenumber } },
                        }
                        : {
                            email: email,
                            "phonenumbers.number": phonenumber,
                        }
                );

                // 2️⃣ If not found, try email only
                if (!matchedScanner) {
                    matchedScanner = await User.findOne({ email: email });
                }

                // 3️⃣ If still not found, try phone only
                if (!matchedScanner) {
                    matchedScanner = await User.findOne(
                        countryCode
                            ? { phonenumbers: { $elemMatch: { countryCode, number: phonenumber } } }
                            : { "phonenumbers.number": phonenumber }
                    );
                }
            } else if (email) {
                // 4️⃣ Only email provided
                matchedScanner = await User.findOne({ email: email });
            } else if (phonenumber) {
                // 5️⃣ Only phone provided (CHANGED for phone schema)
                matchedScanner = await User.findOne(
                    countryCode
                        ? { phonenumbers: { $elemMatch: { countryCode, number: phonenumber } } }
                        : { "phonenumbers.number": phonenumber }
                );
            }
            console.log("Matched Scanner:", matchedScanner);

            if (matchedScanner) {
                // ✅ Treat as registered scanner
                const scanner = matchedScanner;

                if (!Array.isArray(scanner.iScanned)) scanner.iScanned = [];
                if (!Array.isArray(scanner.scannedMe)) scanner.scannedMe = [];
                if (!Array.isArray(user.iScanned)) user.iScanned = [];
                if (!Array.isArray(user.scannedMe)) user.scannedMe = [];

                // Check already connected
                const alreadyConnected =
                    user.scannedMe?.some((entry) => entry._id?.toString() === scanner._id.toString()) ||
                    user.iScanned?.some((entry) => entry._id?.toString() === scanner._id.toString()) ||
                    scanner.scannedMe?.some((entry) => entry._id?.toString() === user._id.toString()) ||
                    scanner.iScanned?.some((entry) => entry._id?.toString() === user._id.toString());

                if (!alreadyConnected) {
                    // Add to scannedMe
                    user.scannedMe.push({
                        _id: scanner._id,
                        firstname: scanner.firstname || "",
                        lastname: scanner.lastname || "",
                        email: scanner.email || "",
                        // CHANGED
                        phonenumber: scanner.phonenumbers?.[0]?.number || "",
                        countryCode: scanner.phonenumbers?.[0]?.countryCode || "",
                        linkedin: scanner.linkedin || "",
                        instagram: scanner.instagram || "",
                        telegram: scanner.telegram || "",
                        twitter: scanner.twitter || "",
                        facebook: scanner.facebook || "",
                        createdAt: new Date(),
                    });

                    // Add to iScanned
                    scanner.iScanned.push({
                        _id: user._id,
                        firstname: user.firstname || "",
                        lastname: user.lastname || "",
                        email: user.email || "",
                        // CHANGED
                        phonenumber: user.phonenumbers?.[0]?.number || "",
                        countryCode: user.phonenumbers?.[0]?.countryCode || "",
                        linkedin: user.linkedin || "",
                        instagram: user.instagram || "",
                        telegram: user.telegram || "",
                        twitter: user.twitter || "",
                        facebook: user.facebook || "",
                        createdAt: new Date(),
                    });

                    // ✅ Create contact for UserID (about scanner)
                    // CHANGED: duplicate check uses $elemMatch
                    const contactExistsForUser = await Contact.findOne({
                        createdBy: user._id,
                        $or: [
                            { emailaddresses: { $in: [scanner.email] } },
                            scanner.phonenumbers?.[0]?.number
                                ? {
                                    phonenumbers: {
                                        $elemMatch: {
                                            countryCode: scanner.phonenumbers?.[0]?.countryCode || "",
                                            number: scanner.phonenumbers?.[0]?.number || "",
                                        },
                                    },
                                }
                                : { _id: null },
                        ],
                    });
                    if (!contactExistsForUser) {
                        const newContact = new Contact({
                            firstname: scanner.firstname || "",
                            lastname: scanner.lastname || "",
                            emailaddresses: [scanner.email || ""],
                            // CHANGED: save whole object
                            phonenumbers:
                                Array.isArray(scanner.phonenumbers) && scanner.phonenumbers[0]
                                    ? [scanner.phonenumbers[0]]
                                    : [],
                            linkedin: scanner.linkedin || "",
                            instagram: scanner.instagram || "",
                            telegram: scanner.telegram || "",
                            twitter: scanner.twitter || "",
                            facebook: scanner.facebook || "",
                            createdBy: user._id,
                        });
                        newContact.contact_id = newContact._id;
                        await newContact.save();
                    }

                    // ✅ Create contact for Scanner (about user)
                    // CHANGED: duplicate check uses $elemMatch
                    const contactExistsForScanner = await Contact.findOne({
                        createdBy: scanner._id,
                        $or: [
                            { emailaddresses: { $in: [user.email] } },
                            user.phonenumbers?.[0]?.number
                                ? {
                                    phonenumbers: {
                                        $elemMatch: {
                                            countryCode: user.phonenumbers?.[0]?.countryCode || "",
                                            number: user.phonenumbers?.[0]?.number || "",
                                        },
                                    },
                                }
                                : { _id: null },
                        ],
                    });
                    if (!contactExistsForScanner) {
                        const newContact = new Contact({
                            firstname: user.firstname || "",
                            lastname: user.lastname || "",
                            emailaddresses: [user.email || ""],
                            phonenumbers:
                                Array.isArray(user.phonenumbers) && user.phonenumbers[0]
                                    ? [user.phonenumbers[0]]
                                    : [],
                            linkedin: user.linkedin || "",
                            instagram: user.instagram || "",
                            telegram: user.telegram || "",
                            twitter: user.twitter || "",
                            facebook: user.facebook || "",
                            createdBy: scanner._id,
                        });
                        newContact.contact_id = newContact._id;
                        await newContact.save();
                    }

                    await scanner.save();
                    updated = true;
                }
            } else {
                // 🔹 No registered user match → unregistered scanner logic
                // CHANGED: duplicate check now compares number + countryCode when provided
                const alreadyExists = user.scannedMe.some(
                    (entry) =>
                        typeof entry === "object" &&
                        (entry.email === email ||
                            (phonenumber &&
                                entry.phonenumber === phonenumber &&
                                (countryCode ? entry.countryCode === countryCode : true)))
                );

                if (!alreadyExists) {
                    user.scannedMe.push({
                        firstname: firstname || "",
                        lastname: lastname || "",
                        email: email || "",
                        // CHANGED: store number + countryCode
                        phonenumber: phonenumber || "",
                        countryCode: countryCode || "",
                        createdAt: new Date(),
                    });
                    updated = true;

                    // ✅ Create contact for UserID from temp data
                    // CHANGED: duplicate check uses $elemMatch if countryCode present
                    const contactExists = await Contact.findOne({
                        createdBy: user._id,
                        $or: [
                            { emailaddresses: { $in: [email] } },
                            phonenumber
                                ? countryCode
                                    ? {
                                        phonenumbers: { $elemMatch: { countryCode, number: phonenumber } },
                                    }
                                    : { "phonenumbers.number": phonenumber }
                                : { _id: null },
                        ],
                    });

                    if (!contactExists) {
                        const newContact = new Contact({
                            firstname: firstname || "",
                            lastname: lastname || "",
                            emailaddresses: [email || ""],
                            // CHANGED: save phone object from raw values
                            phonenumbers: phonenumber
                                ? [{ countryCode: countryCode || "", number: phonenumber }]
                                : [],
                            createdBy: user._id,
                        });
                        newContact.contact_id = newContact._id;
                        await newContact.save();
                    }
                }
            }
        }

        if (updated) await user.save();

        const responseData = {
            userScannedMe: user.scannedMe,
            userIScanned: user.iScanned || [],
        };

        if (ScannerID) {
            const scanner = await User.findById(ScannerID).lean(); // get latest data
            responseData.scannerScannedMe = scanner?.scannedMe || [];
            responseData.scannerIScanned = scanner?.iScanned || [];
        }

        return res.status(200).json({
            status: "success",
            message: "Scan successful",
            data: responseData,
        });
    } catch (error) {
        console.error("Scan error:", error);
        return res.status(500).json({ status: "error", message: "Scan error", error: error.message });
    }
};
