const Contact = require("../models/contactModel");
const User = require("../models/userModel");
const mongoose = require("mongoose");
const { parsePhoneNumberFromString } = require("libphonenumber-js");

const saveBulkContacts = async (req, res) => {
  try {
    const BATCH_SIZE = 10000; // Safe batch size for millions of contacts
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized: User not found",
      });
    }

    const { contacts } = req.body;
    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "No contacts provided",
      });
    }

    const allowedFields = [
      "firstname",
      "lastname",
      "company",
      "designation",
      "linkedin",
      "instagram",
      "telegram",
      "twitter",
      "facebook",
      "emailaddresses",
      "phonenumbers",
    ];

    const newContacts = [];
    const updatedContacts = [];
    const skippedContacts = [];

    // Function to preprocess contacts (normalize phone & email)
    const preprocessContact = (contact) => {
      const invalidKeys = Object.keys(contact).filter(
        (key) => !allowedFields.includes(key)
      );
      if (invalidKeys.length > 0) {
        throw new Error(`Invalid columns: ${invalidKeys.join(", ")}`);
      }

      const {
        firstname = "",
        lastname = "",
        company = "",
        designation = "",
        linkedin = "",
        instagram = "",
        telegram = "",
        twitter = "",
        facebook = "",
        emailaddresses = [],
        phonenumbers = [],
      } = contact;

      let phoneList = [];

      if (Array.isArray(phonenumbers) && phonenumbers.length > 0) {
        const num = phonenumbers[0]; // only first number
        let phoneObj = { countryCode: "", number: "" };
        if (typeof num === "object" && num.number) {
          phoneObj.countryCode = num.countryCode || "";
          phoneObj.number = String(num.number).replace(/[^\d]/g, "");
        } else {
          const parsed = parsePhoneNumberFromString(String(num));
          if (parsed) {
            phoneObj.countryCode = parsed.countryCallingCode || "";
            phoneObj.number =
              parsed.nationalNumber || String(num).replace(/[^\d]/g, "");
          } else {
            phoneObj.number = String(num).replace(/[^\d]/g, "");
          }
        }
        if (phoneObj.number) phoneList.push(phoneObj);
      } else if (phonenumbers) {
        let phoneObj = { countryCode: "", number: "" };
        const parsed = parsePhoneNumberFromString(String(phonenumbers));
        if (parsed) {
          phoneObj.countryCode = parsed.countryCallingCode || "";
          phoneObj.number =
            parsed.nationalNumber || String(phonenumbers).replace(/[^\d]/g, "");
        } else {
          phoneObj.number = String(phonenumbers).replace(/[^\d]/g, "");
        }
        if (phoneObj.number) phoneList.push(phoneObj);
      }

      const emailList = Array.isArray(emailaddresses)
        ? emailaddresses.filter((e) => e)
        : emailaddresses
          ? [emailaddresses]
          : [];

      return {
        raw: contact,
        normalized: {
          firstname,
          lastname,
          company,
          designation,
          linkedin,
          instagram,
          telegram,
          twitter,
          facebook,
          emailaddresses: emailList,
          phonenumbers: phoneList,
        },
      };
    };

    // Split contacts into batches
    for (let batchStart = 0; batchStart < contacts.length; batchStart += BATCH_SIZE) {
      const batchContacts = contacts.slice(batchStart, batchStart + BATCH_SIZE);
      const processedBatch = batchContacts.map(preprocessContact);

      // Collect all phone numbers and emails for this batch
      const allNumbers = processedBatch.flatMap((c) =>
        c.normalized.phonenumbers.map((p) => p.number)
      );
      const allEmails = processedBatch.flatMap(
        (c) => c.normalized.emailaddresses
      );

      // Fetch existing contacts for this batch only
      const existingContactsBatch = await Contact.find({
        createdBy: req.user._id,
        $or: [
          { "phonenumbers.number": { $in: allNumbers } },
          { emailaddresses: { $in: allEmails } },
        ],
      }).lean();

      // Build lookup maps for fast O(1) lookup
      const emailMap = new Map();
      const phoneMap = new Map();
      for (const ec of existingContactsBatch) {
        (ec.emailaddresses || []).forEach((e) => emailMap.set(e, ec));
        (ec.phonenumbers || []).forEach((p) => phoneMap.set(p.number, ec));
      }

      const bulkOps = [];

      for (const { raw, normalized } of processedBatch) {
        const {
          firstname,
          lastname,
          company,
          designation,
          linkedin,
          instagram,
          telegram,
          twitter,
          facebook,
          emailaddresses,
          phonenumbers,
        } = normalized;

        // Lookup existing contact using map
        let existing = null;
        for (const e of emailaddresses) {
          if (emailMap.has(e)) {
            existing = emailMap.get(e);
            break;
          }
        }
        if (!existing) {
          for (const p of phonenumbers) {
            if (phoneMap.has(p.number)) {
              existing = phoneMap.get(p.number);
              break;
            }
          }
        }

        if (!existing) {
          const generatedId = new mongoose.Types.ObjectId();
          const newContact = {
            _id: generatedId,
            contact_id: generatedId,
            ...normalized,
            activities: [
              {
                action: "contact_created",
                type: "contact",
                title: "Contact Imported",
                description: `${firstname} ${lastname}`,
              },
            ],
            createdBy: req.user._id,
          };
          newContacts.push(newContact);
          bulkOps.push({
            insertOne: { document: newContact },
          });
        } else {
          const existingPhones = existing.phonenumbers || [];
          const existingEmails = existing.emailaddresses || [];

          const newPhones = phonenumbers.filter(
            (p) =>
              !existingPhones.some(
                (ep) => ep.number === p.number && ep.countryCode === p.countryCode
              )
          );
          const newEmails = emailaddresses.filter((e) => !existingEmails.includes(e));

          const hasNewData = newPhones.length > 0 || newEmails.length > 0;
          if (!hasNewData) {
            skippedContacts.push(raw);
            continue;
          }

          bulkOps.push({
            updateOne: {
              filter: { _id: existing._id },
              update: {
                $addToSet: {
                  phonenumbers: { $each: newPhones },
                  emailaddresses: { $each: newEmails },
                },
                $set: {
                  firstname: firstname || existing.firstname,
                  lastname: lastname || existing.lastname,
                  company: company || existing.company,
                  designation: designation || existing.designation,
                  linkedin: linkedin || existing.linkedin,
                  instagram: instagram || existing.instagram,
                  telegram: telegram || existing.telegram,
                  twitter: twitter || existing.twitter,
                  facebook: facebook || existing.facebook,
                },
              },
            },
          });
          updatedContacts.push({ ...existing, ...normalized });
        }
      }

      // Execute bulkWrite in batch
      if (bulkOps.length > 0) {
        await Contact.bulkWrite(bulkOps, { ordered: false });
      }
    }

    return res.status(201).json({
      status: "success",
      message: `Processed ${contacts.length} contact(s): ${newContacts.length} added, ${updatedContacts.length} updated, ${skippedContacts.length} skipped.`,
      data: {
        added: newContacts,
        updated: updatedContacts,
        skipped: skippedContacts,
      },
    });
  } catch (error) {
    console.error("Bulk contact save error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Something went wrong",
    });
  }
};

module.exports = { saveBulkContacts };