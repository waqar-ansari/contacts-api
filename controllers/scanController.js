const User = require("../models/userModel");
const Contact = require("../models/contactModel"); // adjust the path as needed
const { mongoose } = require("mongoose");
// ADD this at the top with other imports
const { parsePhoneNumberFromString } = require("libphonenumber-js");
const { getUserCurrentPlan } = require("../utils/stripeUtils");
// add near top with other imports:
const {
  sendOwnerNotification,
  sendProfileAndVcard,
} = require("../utils/emailUtils");
const {
  ensureScanQuotaForOwner,
  incrementOwnerCategoryCounter,
} = require("../utils/contactCount");


exports.scanUser = async (req, res) => {

  // CHANGED: accept countryCode from body for unregistered scanner path
  const {
    UserID,
    ScannerID,
    firstname,
    lastname,
    email,
    phonenumber,
    countryCode,
    apiType = "web",
  } = req.body;

  try {
    // Get the user who is being scanned
    const user = await User.findById(UserID); // QR code owner

    if (!user) {
      return res
        .status(404)
        .json({ status: "error", message: "Scanned user (UserID) not found" });
    }
    console.log(user);

    const useTestMode = user.stripe_test_mode || false;


    // ✅ Normalize phone depending on apiType
    let parsedPhone = null;

    if (apiType === "mobile") {
      // Mobile: separate fields already provided
      if (phonenumber && countryCode) {
        parsedPhone = {
          countryCode: String(countryCode).replace(/[^\d]/g, ""),
          number: String(phonenumber).replace(/[^\d]/g, ""),
        };
      }
    } else if (apiType === "web") {
      if (phonenumber) {
        let raw = String(phonenumber).replace(/\s+/g, ""); // remove spaces

        // ✅ If it's digits like "917046658651"
        if (/^\d+$/.test(raw)) {
          parsedPhone = {
            countryCode: raw.slice(0, raw.length - 10), // first digits as countryCode
            number: raw.slice(-10), // last 10 as local number
          };
        } else {
          // fallback → use libphonenumber-js
          if (!raw.startsWith("+")) {
            raw = "+" + raw.replace(/[^\d]/g, "");
          }
          try {
            const phone = parsePhoneNumberFromString(raw);
            if (phone) {
              parsedPhone = {
                countryCode: phone.countryCallingCode,
                number: phone.nationalNumber,
              };
            }
          } catch (err) {
            console.error("Phone parse failed:", err);
          }
        }
      }
    }

    if (!Array.isArray(user.scannedMe)) user.scannedMe = [];

    let updated = false;

    if (ScannerID) {
      const scanner = await User.findById(ScannerID);
      if (!scanner) {
        return res
          .status(404)
          .json({ status: "error", message: "Scanner (ScannerID) not found" });
      }

      // Get scanner's current plan from subscription
      const scannerPlan = await getUserCurrentPlan(scanner, useTestMode);
      console.log(scannerPlan);

      // ---- PLAN LIMIT CHECK FOR REGISTERED SCANNER ----
      const planName = scannerPlan?.name?.toLowerCase() || "starter";
      console.log("planname" + planName);

      let scanLimit = 50; // default for Free
      if (planName === "pro") scanLimit = Infinity;

      // Count how many contacts this scanner has created (i.e., how many times they've scanned)
      const scanCount = await Contact.countDocuments({
        createdBy: scanner._id,
        category: { $in: ["qrScan", "lead"] },
      });
      console.log("scancount" + scanCount);

      if (scanCount >= scanLimit) {
        return res.status(403).json({
          status: "error",
          message:
            planName === "pro"
              ? "You have reached your scan limit. Please contact support."
              : "You have reached the maximum number of scans allowed for your plan. Upgrade to Pro for unlimited scans.",
          action: "Upgrade Plan",
        });
      }

      if (!Array.isArray(scanner.iScanned)) scanner.iScanned = [];
      if (!Array.isArray(scanner.scannedMe)) scanner.scannedMe = [];
      if (!Array.isArray(user.iScanned)) user.iScanned = [];
      if (!Array.isArray(user.scannedMe)) user.scannedMe = [];

      // ✅ MUTUAL CHECK: has scan already happened in either direction?
      const alreadyConnected =
        user.scannedMe?.some(
          (entry) =>
            typeof entry === "object" &&
            entry._id?.toString() === scanner._id.toString()
        ) ||
        scanner.scannedMe?.some(
          (entry) =>
            typeof entry === "object" &&
            entry._id?.toString() === user._id.toString()
        ) ||
        user.iScanned?.some(
          (entry) =>
            typeof entry === "object" &&
            entry._id?.toString() === scanner._id.toString()
        ) ||
        scanner.iScanned?.some(
          (entry) =>
            typeof entry === "object" &&
            entry._id?.toString() === user._id.toString()
        );

      if (alreadyConnected) {
        return res.status(400).json({
          status: "error",
          message: "Users already connected.",
        });
      }

      // Add Scanner full info into scanned user's scannedMe
      const alreadyScanned = user.scannedMe.some(
        (entry) =>
          typeof entry === "object" &&
          entry._id?.toString() === scanner._id.toString()
      );

      if (!alreadyScanned) {
        // atomic add to user's scannedMe only if scanner._id is not already present
        const pushResult = await User.updateOne(
          {
            _id: user._id,
            "scannedMe._id": { $ne: scanner._id },
          },
          {
            $push: {
              scannedMe: {
                _id: scanner._id,
                firstname: scanner.firstname || "",
                lastname: scanner.lastname || "",
                email: scanner.email || "",
                phonenumber: scanner.phonenumbers?.[0]?.number || "",
                countryCode: scanner.phonenumbers?.[0]?.countryCode || "",
                linkedin: scanner.linkedin || "",
                instagram: scanner.instagram || "",
                telegram: scanner.telegram || "",
                twitter: scanner.twitter || "",
                facebook: scanner.facebook || "",
                createdAt: new Date(),
              },
            },
          }
        );

        // pushResult.nModified / modifiedCount indicates whether a change occurred
        updated = !!(pushResult.modifiedCount || pushResult.nModified);
        // Second: Save contact in user's contacts (scanner info)
        // CHANGED: duplicate check uses $elemMatch
        // const contactExistsForUser = await Contact.findOne({
        //   createdBy: user._id,
        //   $or: [
        //     { emailaddresses: { $in: [scanner.email] } },
        //     scanner.phonenumbers?.[0]?.number
        //       ? {
        //         phonenumbers: {
        //           $elemMatch: {
        //             countryCode: scanner.phonenumbers?.[0]?.countryCode || "",
        //             number: scanner.phonenumbers?.[0]?.number || "",
        //           },
        //         },
        //       }
        //       : { _id: null },
        //   ],
        // });

        // ------------------ ATOMIC upsert for contact (owner = user._id) ------------------
        const scannerEmail = scanner?.email || "";
        const scannerPhone = (Array.isArray(scanner?.phonenumbers) && scanner.phonenumbers[0])
          ? scanner.phonenumbers[0].number
          : "";
        const scannerCountryCode = (Array.isArray(scanner?.phonenumbers) && scanner.phonenumbers[0])
          ? scanner.phonenumbers[0].countryCode
          : "";

        // Build a filter that matches existing contact by email OR phone
        const contactFilterForUser = {
          createdBy: user._id,
          $or: [
            { emailaddresses: { $in: [scannerEmail || ""] } },
            scannerPhone
              ? { phonenumbers: { $elemMatch: { countryCode: scannerCountryCode || "", number: scannerPhone } } }
              : { _id: null },
          ],
        };

        // Document to insert only if not exists
        const contactDocForUserOnInsert = {
          firstname: scanner?.firstname || "",
          lastname: scanner?.lastname || "",
          category: "qrScan",
          emailaddresses: scannerEmail ? [scannerEmail] : [""],
          phonenumbers: scannerPhone ? [{ countryCode: scannerCountryCode || "", number: scannerPhone }] : [],
          linkedin: scanner?.linkedin || "",
          instagram: scanner?.instagram || "",
          telegram: scanner?.telegram || "",
          twitter: scanner?.twitter || "",
          facebook: scanner?.facebook || "",
          createdBy: user._id,
          createdAt: new Date(),
          activities: [{
            action: "created",
            type: "contact",
            title: "New Contact Added",
            description: `Contact ${user.firstname || ""} ${user.lastname || ""} was added via QR scan`,
            createdAt: new Date()
          }]
        };

        // Atomic upsert (insert only if not present)
        const upsertResultForUser = await Contact.updateOne(
          contactFilterForUser,
          { $setOnInsert: contactDocForUserOnInsert },
          { upsert: true }
        );

        // If insert happened, increment owner counter
        if (upsertResultForUser.upsertedCount && upsertResultForUser.upsertedCount > 0) {
          await incrementOwnerCategoryCounter(user._id, "qrScan");
        }

        // quota check for the owner of the new contact (owner is `user._id` here)
        try {
          await ensureScanQuotaForOwner(user._id, "qrScan", null, useTestMode); // throws if limit reached
        } catch (err) {
          return res
            .status(403)
            .json({ status: "error", message: err.message, action: "Upgrade Plan", });
        }

        // if (!contactExistsForUser) {
        //   const newContact = new Contact({
        //     firstname: scanner.firstname || "",
        //     lastname: scanner.lastname || "",
        //     category: "qrScan",
        //     emailaddresses: [scanner.email || ""],
        //     // CHANGED: save whole object
        //     phonenumbers:
        //       Array.isArray(scanner.phonenumbers) && scanner.phonenumbers[0]
        //         ? [scanner.phonenumbers[0]]
        //         : [],
        //     linkedin: scanner.linkedin || "",
        //     instagram: scanner.instagram || "",
        //     telegram: scanner.telegram || "",
        //     twitter: scanner.twitter || "",
        //     facebook: scanner.facebook || "",
        //     createdBy: user._id,
        //   });
        //   newContact.contact_id = newContact._id; // ensure consistency
        //   newContact.activities.push({
        //     action: "created",
        //     type: "contact",
        //     title: "New Contact Added",
        //     description: `Contact ${user.firstname || ""} ${user.lastname || ""
        //       } was added via QR scan`,
        //   });
        //   // increment the owner's counter for qr scans
        //   await newContact.save();
        //   await incrementOwnerCategoryCounter(user._id, "qrScan");
        // }
      }

      // Add User full info into scanner's iScanned
      const alreadyInIScanned = scanner.iScanned.some(
        (entry) =>
          typeof entry === "object" &&
          entry._id?.toString() === user._id.toString()
      );

      if (!alreadyInIScanned) {
        // atomic add to scanner.iScanned only if user._id not present already
        const pushScannerResult = await User.updateOne(
          {
            _id: scanner._id,
            "iScanned._id": { $ne: user._id },
          },
          {
            $push: {
              iScanned: {
                _id: user._id,
                firstname: user.firstname || "",
                lastname: user.lastname || "",
                email: user.email || "",
                phonenumber: user.phonenumbers?.[0]?.number || "",
                countryCode: user.phonenumbers?.[0]?.countryCode || "",
                linkedin: user.linkedin || "",
                instagram: user.instagram || "",
                telegram: user.telegram || "",
                twitter: user.twitter || "",
                facebook: user.facebook || "",
                createdAt: new Date(),
              },
            },
          }
        );

        // optional: you can use this to know whether scanner changed
        const scannerUpdated = !!(
          pushScannerResult.modifiedCount || pushScannerResult.nModified
        );
      }
    } else {
      // Case 2: Scanner is not registered — store temp data in scannedMe

      // 🔹 Step 1: Try to match existing registered user with given email + phonenumber
      let matchedScanner = null;

      if (email && parsedPhone) {
        matchedScanner = await User.findOne({
          email: email,
          phonenumbers: { $elemMatch: parsedPhone },
        });

        // 2️⃣ If not found, try email only
        if (!matchedScanner) {
          matchedScanner = await User.findOne({ email: email });
        }

        // 3️⃣ If still not found, try phone only
        if (!matchedScanner) {
          matchedScanner = await User.findOne({
            phonenumbers: { $elemMatch: parsedPhone },
          });
        }
      } else if (email) {
        // 4️⃣ Only email provided
        matchedScanner = await User.findOne({ email: email });
      } else if (phonenumber) {
        matchedScanner = await User.findOne(
          parsedPhone
            ? { phonenumbers: { $elemMatch: parsedPhone } }
            : { "phonenumbers.number": phonenumber }
        );
      }
      console.log("Matched Scanner:", matchedScanner);

      if (matchedScanner) {
        // ✅ Treat as registered scanner
        const scanner = matchedScanner;

        // PLAN LIMIT CHECK FOR REGISTERED (matched) SCANNER
        const scannerPlan = await getUserCurrentPlan(
          matchedScanner,
          useTestMode
        );
        const planName = scannerPlan?.name?.toLowerCase() || "starter";
        let scanLimit = 50;
        if (planName === "pro") scanLimit = Infinity;

        const scanCount = await Contact.countDocuments({
          createdBy: matchedScanner._id,
        });

        if (scanCount >= scanLimit) {
          return res.status(403).json({
            status: "error",
            message:
              planName === "pro"
                ? "You have reached your scan limit. Please contact support."
                : "You have reached the maximum number of scans allowed for your plan. Upgrade to Pro for unlimited scans.",
            action: "Upgrade Plan",
          });
        }

        if (!Array.isArray(scanner.iScanned)) scanner.iScanned = [];
        if (!Array.isArray(scanner.scannedMe)) scanner.scannedMe = [];
        if (!Array.isArray(user.iScanned)) user.iScanned = [];
        if (!Array.isArray(user.scannedMe)) user.scannedMe = [];

        // Check already connected
        const alreadyConnected =
          user.scannedMe?.some(
            (entry) => entry._id?.toString() === scanner._id.toString()
          ) ||
          user.iScanned?.some(
            (entry) => entry._id?.toString() === scanner._id.toString()
          ) ||
          scanner.scannedMe?.some(
            (entry) => entry._id?.toString() === user._id.toString()
          ) ||
          scanner.iScanned?.some(
            (entry) => entry._id?.toString() === user._id.toString()
          );

        if (!alreadyConnected) {
          // // Add to scannedMe

          // Add to scannedMe atomically
          const pushUserResult = await User.updateOne(
            {
              _id: user._id,
              "scannedMe._id": { $ne: scanner._id },
            },
            {
              $push: {
                scannedMe: {
                  _id: scanner._id,
                  firstname: scanner.firstname || "",
                  lastname: scanner.lastname || "",
                  email: scanner.email || "",
                  phonenumber: parsedPhone?.number || "",
                  countryCode: parsedPhone?.countryCode || "",
                  linkedin: scanner.linkedin || "",
                  instagram: scanner.instagram || "",
                  telegram: scanner.telegram || "",
                  twitter: scanner.twitter || "",
                  facebook: scanner.facebook || "",
                  createdAt: new Date(),
                },
              },
            }
          );

          const userPushed = !!(
            pushUserResult.modifiedCount || pushUserResult.nModified
          );

          // Add to scanner.iScanned atomically
          const pushScannerResult = await User.updateOne(
            {
              _id: scanner._id,
              "iScanned._id": { $ne: user._id },
            },
            {
              $push: {
                iScanned: {
                  _id: user._id,
                  firstname: user.firstname || "",
                  lastname: user.lastname || "",
                  email: user.email || "",
                  phonenumber: user.phonenumbers?.[0]?.number || "",
                  countryCode: user.phonenumbers?.[0]?.countryCode || "",
                  linkedin: user.linkedin || "",
                  instagram: user.instagram || "",
                  telegram: user.telegram || "",
                  twitter: user.twitter || "",
                  facebook: user.facebook || "",
                  createdAt: new Date(),
                },
              },
            }
          );

          // ✅ Create contact for UserID (about scanner)
          // CHANGED: duplicate check uses $elemMatch
          // const contactExistsForUser = await Contact.findOne({
          //   createdBy: user._id,
          //   $or: [
          //     { emailaddresses: { $in: [scanner.email] } },
          //     scanner.phonenumbers?.[0]?.number
          //       ? {
          //         phonenumbers: {
          //           $elemMatch: {
          //             countryCode:
          //               scanner.phonenumbers?.[0]?.countryCode || "",
          //             number: scanner.phonenumbers?.[0]?.number || "",
          //           },
          //         },
          //       }
          //       : { _id: null },
          //   ],
          // });
          // await ensureScanQuotaForOwner(user._id, 'lead');

          // ------------------ ATOMIC upsert for contact (owner = user._id) in matchedScanner path ------------------
          const matchedScannerEmail = scanner?.email || "";
          const matchedScannerPhone = parsedPhone ? parsedPhone.number : (Array.isArray(scanner?.phonenumbers) && scanner.phonenumbers[0] ? scanner.phonenumbers[0].number : "");
          const matchedScannerCountryCode = parsedPhone ? parsedPhone.countryCode : (Array.isArray(scanner?.phonenumbers) && scanner.phonenumbers[0] ? scanner.phonenumbers[0].countryCode : "");

          const contactFilterForUserMatched = {
            createdBy: user._id,
            $or: [
              { emailaddresses: { $in: [matchedScannerEmail || ""] } },
              matchedScannerPhone
                ? { phonenumbers: { $elemMatch: { countryCode: matchedScannerCountryCode || "", number: matchedScannerPhone } } }
                : { _id: null },
            ],
          };

          const contactDocForUserMatchedOnInsert = {
            firstname: scanner?.firstname || "",
            lastname: scanner?.lastname || "",
            category: "lead",
            emailaddresses: matchedScannerEmail ? [matchedScannerEmail] : [""],
            phonenumbers: matchedScannerPhone ? [{ countryCode: matchedScannerCountryCode || "", number: matchedScannerPhone }] : [],
            linkedin: scanner?.linkedin || "",
            instagram: scanner?.instagram || "",
            telegram: scanner?.telegram || "",
            twitter: scanner?.twitter || "",
            facebook: scanner?.facebook || "",
            createdBy: user._id,
            createdAt: new Date(),
            activities: [{
              action: "created",
              type: "contact",
              title: "New Contact Added (Unregistered)",
              description: `Temporary contact ${firstname || ""} ${lastname || ""} added via QR scan`,
              createdAt: new Date()
            }]
          };

          const upsertResultForUserMatched = await Contact.updateOne(
            contactFilterForUserMatched,
            { $setOnInsert: contactDocForUserMatchedOnInsert },
            { upsert: true }
          );

          if (upsertResultForUserMatched.upsertedCount && upsertResultForUserMatched.upsertedCount > 0) {
            await incrementOwnerCategoryCounter(user._id, "lead");
          }


          try {
            await ensureScanQuotaForOwner(user._id, "lead", null, useTestMode); // throws if limit reached
          } catch (err) {
            return res
              .status(403)
              .json({ status: "error", message: err.message, action: "Upgrade Plan", });
          }
          // if (!contactExistsForUser) {
          //   const newContact = new Contact({
          //     firstname: scanner.firstname || "",
          //     lastname: scanner.lastname || "",
          //     category: "lead",
          //     emailaddresses: [scanner.email || ""],
          //     phonenumbers: parsedPhone
          //       ? [parsedPhone]
          //       : Array.isArray(scanner.phonenumbers) && scanner.phonenumbers[0]
          //         ? [scanner.phonenumbers[0]]
          //         : [],
          //     linkedin: scanner.linkedin || "",
          //     instagram: scanner.instagram || "",
          //     telegram: scanner.telegram || "",
          //     twitter: scanner.twitter || "",
          //     facebook: scanner.facebook || "",
          //     createdBy: user._id,
          //   });
          //   newContact.contact_id = newContact._id;
          //   newContact.activities.push({
          //     action: "created",
          //     type: "contact",
          //     title: "New Contact Added (Unregistered)",
          //     description: `Temporary contact ${firstname || ""} ${lastname || ""
          //       } added via QR scan`,
          //   });
          //   await newContact.save();
          //   await incrementOwnerCategoryCounter(user._id, "lead");
          // }

          // ✅ Create contact for Scanner (about user)
          // CHANGED: duplicate check uses $elemMatch

          // ------------------ ATOMIC upsert for contact (owner = scanner._id) in matchedScanner path ------------------
          const userEmailForScanner = user?.email || "";
          const userPhoneForScanner = Array.isArray(user?.phonenumbers) && user.phonenumbers[0] ? user.phonenumbers[0].number : "";
          const userCountryCodeForScanner = Array.isArray(user?.phonenumbers) && user.phonenumbers[0] ? user.phonenumbers[0].countryCode : "";

          const contactFilterForScanner = {
            createdBy: scanner._id,
            $or: [
              { emailaddresses: { $in: [userEmailForScanner || ""] } },
              userPhoneForScanner
                ? { phonenumbers: { $elemMatch: { countryCode: userCountryCodeForScanner || "", number: userPhoneForScanner } } }
                : { _id: null },
            ],
          };

          const contactDocForScannerOnInsert = {
            firstname: user?.firstname || "",
            lastname: user?.lastname || "",
            category: "lead",
            emailaddresses: userEmailForScanner ? [userEmailForScanner] : [""],
            phonenumbers: userPhoneForScanner ? [{ countryCode: userCountryCodeForScanner || "", number: userPhoneForScanner }] : [],
            linkedin: user?.linkedin || "",
            instagram: user?.instagram || "",
            telegram: user?.telegram || "",
            twitter: user?.twitter || "",
            facebook: user?.facebook || "",
            createdBy: scanner._id,
            createdAt: new Date()
          };

          const upsertResultForScanner = await Contact.updateOne(
            contactFilterForScanner,
            { $setOnInsert: contactDocForScannerOnInsert },
            { upsert: true }
          );

          // If needed, you can inspect upsertResultForScanner to know if a new contact was created


          // const contactExistsForScanner = await Contact.findOne({
          //   createdBy: scanner._id,
          //   $or: [
          //     { emailaddresses: { $in: [user.email] } },
          //     user.phonenumbers?.[0]?.number
          //       ? {
          //         phonenumbers: {
          //           $elemMatch: {
          //             countryCode: user.phonenumbers?.[0]?.countryCode || "",
          //             number: user.phonenumbers?.[0]?.number || "",
          //           },
          //         },
          //       }
          //       : { _id: null },
          //   ],
          // });
          // if (!contactExistsForScanner) {
          //   const newContact = new Contact({
          //     firstname: user.firstname || "",
          //     lastname: user.lastname || "",
          //     category: "lead",
          //     emailaddresses: [user.email || ""],
          //     phonenumbers: parsedPhone
          //       ? [parsedPhone] // ✅ use normalized phone for web/mobile
          //       : Array.isArray(user.phonenumbers) && user.phonenumbers[0]
          //         ? [user.phonenumbers[0]]
          //         : [],
          //     linkedin: user.linkedin || "",
          //     instagram: user.instagram || "",
          //     telegram: user.telegram || "",
          //     twitter: user.twitter || "",
          //     facebook: user.facebook || "",
          //     createdBy: scanner._id,
          //   });
          //   newContact.contact_id = newContact._id;
          //   await newContact.save();
          // }

          // await scanner.save();
          // updated = true;

          const scannerPushed = !!(
            pushScannerResult.modifiedCount || pushScannerResult.nModified
          );
          updated = userPushed || scannerPushed;
        }
      } else {
        // PLAN LIMIT CHECK FOR UNREGISTERED (TEMP) SCANNER
        // Limit by how many times this temp user (by email/phone) is in user.scannedMe
        const tempScans = user.scannedMe.filter(
          (entry) =>
            (email && entry.email === email) ||
            (phonenumber &&
              entry.phonenumber === phonenumber &&
              (!countryCode || entry.countryCode === countryCode))
        ).length;

        if (tempScans >= 50) {
          return res.status(403).json({
            status: "error",
            message:
              "You have reached the maximum number of scans allowed for unregistered users on the Free plan. Please register or upgrade.",
            action: "Upgrade Plan",
          });
        }

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
          // Add temp entry atomically — match by email OR (countryCode+phonenumber)
          // We'll use a composite id to try avoid duplicates for temp entries:
          const tempEntry = {
            _id: new mongoose.Types.ObjectId(), // unique id for this temp entry
            firstname: firstname || "",
            lastname: lastname || "",
            email: email || "",
            phonenumber: parsedPhone?.number || phonenumber || "",
            countryCode: parsedPhone?.countryCode || countryCode || "",
            createdAt: new Date(),
          };

          // Use $push with a filter that checks email and phone absence
          const pushTempResult = await User.updateOne(
            {
              _id: user._id,
              $and: [
                {
                  $or: [
                    { "scannedMe.email": { $ne: email } },
                    { "scannedMe.email": { $exists: false } },
                  ],
                },
                {
                  $or: [
                    { "scannedMe.phonenumber": { $ne: tempEntry.phonenumber } },
                    { "scannedMe.phonenumber": { $exists: false } },
                  ],
                },
              ],
            },
            {
              $push: { scannedMe: tempEntry },
            }
          );

          updated = !!(
            pushTempResult.modifiedCount || pushTempResult.nModified
          );

          // ---------- EMAIL: notify owner about temporary submitter & send vCard to temp submitter ----------
          try {
            await sendOwnerNotification(user.email, user, {
              firstname: firstname,
              lastname: lastname,
              email: email,
              phonenumber: parsedPhone?.number || phonenumber || "",
              countryCode: parsedPhone?.countryCode || countryCode || "",
              linkedin: null,
              instagram: null,
              telegram: null,
              twitter: null,
              facebook: null,
              createdAt: new Date(),
            });
          } catch (err) {
            console.error("Owner notification (temp) failed:", err);
          }

          if (email) {
            try {
              await sendProfileAndVcard(email, user, {
                firstname: firstname,
                lastname: lastname,
              });
              // await sendProfileAndVcard(scanner.email, user, scanner);
            } catch (err) {
              console.error("Send vCard to temp user failed:", err);
            }
          }
          // -----------------------------------------------------------------------

          // ✅ Create contact for UserID from temp data
          // CHANGED: duplicate check uses $elemMatch if countryCode present
          const contactExists = await Contact.findOne({
            createdBy: user._id,
            $or: [
              { emailaddresses: { $in: [email] } },
              phonenumber
                ? countryCode
                  ? {
                    phonenumbers: {
                      $elemMatch: { countryCode, number: phonenumber },
                    },
                  }
                  : { "phonenumbers.number": phonenumber }
                : { _id: null },
            ],
          });
          // await ensureScanQuotaForOwner(user._id, 'lead');
          try {
            await ensureScanQuotaForOwner(user._id, "lead", null, useTestMode); // throws if limit reached
          } catch (err) {
            return res
              .status(403)
              .json({ status: "error", message: err.message, action: "Upgrade Plan", });
          }
          if (!contactExists) {
            const newContact = new Contact({
              firstname: firstname || "",
              lastname: lastname || "",
              emailaddresses: [email || ""],
              category: "lead",
              phonenumbers: parsedPhone
                ? [parsedPhone]
                : phonenumber
                  ? [{ countryCode: countryCode || "", number: phonenumber }]
                  : [],
              createdBy: user._id,
            });
            newContact.contact_id = newContact._id;
            await newContact.save();
            await incrementOwnerCategoryCounter(user._id, "lead");
          }
        }
      }
    }

    // if we made atomic updates, refetch the fresh user document for response
    const freshUser = await User.findById(user._id).lean();
    const freshScanner = ScannerID
      ? await User.findById(ScannerID).lean()
      : null;

    const responseData = {
      userScannedMe: freshUser?.scannedMe || [],
      userIScanned: freshUser?.iScanned || [],
    };

    if (ScannerID) {
      responseData.scannerScannedMe = freshScanner?.scannedMe || [];
      responseData.scannerIScanned = freshScanner?.iScanned || [];
    }

    const createdContactsForUser = await Contact.find({ createdBy: user._id })
      .sort({ createdAt: -1 })
      .limit(1);

    let createdContactsForScanner = [];
    if (ScannerID) {
      createdContactsForScanner = await Contact.find({ createdBy: ScannerID })
        .sort({ createdAt: -1 })
        .limit(1);
    }

    responseData.createdContactsForUser = createdContactsForUser;
    responseData.createdContactsForScanner = createdContactsForScanner;

    return res.status(200).json({
      status: "success",
      message: "Scan Done",
      data: responseData,
    });
  } catch (error) {
    console.error("Scan error:", error);
    return res
      .status(500)
      .json({ status: "error", message: "Scan error", error: error.message });
  }
};
