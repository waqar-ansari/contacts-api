// const Contact = require("../models/contactModel");
// const User = require("../models/userModel");
// const mongoose = require("mongoose");

// const saveBulkContacts = async (req, res) => {
//   try {
//     const user = await User.findById(req.user._id);
//     if (!user) {
//       return res.status(401).json({
//         status: "error",
//         message: "Unauthorized: User not found",
//       });
//     }

//     const { contacts } = req.body;
//     if (!Array.isArray(contacts) || contacts.length === 0) {
//       return res.status(400).json({
//         status: "error",
//         message: "No contacts provided",
//       });
//     }
//     const allowedFields = [
//       "firstname",
//       "lastname",
//       "company",
//       "designation",
//       "linkedin",
//       "instagram",
//       "telegram",
//       "twitter",
//       "facebook",
//       "emailaddresses",
//       "phonenumbers",
//     ];
//     for (const contact of contacts) {
//       const invalidKeys = Object.keys(contact).filter(
//         (key) => !allowedFields.includes(key)
//       );
//       if (invalidKeys.length > 0) {
//         return res.status(400).json({
//           status: "error",
//           message: `Invalid columns: ${invalidKeys.join(", ")}`,
//         });
//       }
//     }
//     const bulkPayload = [];
//     const skippedContacts = [];

//     for (const contact of contacts) {
//       const {
//         firstname,
//         lastname,
//         company,
//         designation,
//         linkedin,
//         instagram,
//         telegram,
//         twitter,
//         facebook,
//         emailaddresses,
//         phonenumbers,
//       } = contact;

//       const parsedPhones = Array.isArray(phonenumbers)
//         ? phonenumbers.map((num) => String(num).replace(/[^\d]/g, ""))
//         : [String(phonenumbers).replace(/[^\d]/g, "")];

//       const emailList = Array.isArray(emailaddresses)
//         ? emailaddresses
//         : emailaddresses
//         ? [emailaddresses]
//         : [];
//       const phoneList = parsedPhones;

//       let isDuplicate = false;
//       if (emailList.length || phoneList.length) {
//         const duplicateQuery = {
//           createdBy: req.user._id,
//           $or: [],
//         };

//         if (phoneList.length) {
//           duplicateQuery.$or.push({ phonenumbers: { $in: phoneList } });
//         }
//         if (duplicateQuery.$or.length > 0) {
//           const existing = await Contact.findOne(duplicateQuery);
//           if (existing) isDuplicate = true;
//         }
//       }

//       if (isDuplicate) {
//         skippedContacts.push(contact);
//         continue;
//       }

//       const generatedId = new mongoose.Types.ObjectId();
//       bulkPayload.push({
//         _id: generatedId,
//         contact_id: generatedId,
//         firstname,
//         lastname,
//         company,
//         designation,
//         linkedin,
//         instagram,
//         telegram,
//         twitter,
//         facebook,
//         emailaddresses,
//         phonenumbers: parsedPhones,
//         createdBy: req.user._id,
//       });
//     }

//     const savedContacts = await Contact.insertMany(bulkPayload);

//     return res.status(201).json({
//       status: "success",
//       message: `Processed ${contacts.length} contact(s): ${savedContacts.length} added, ${skippedContacts.length} skipped (duplicates).`,
//       data: savedContacts.map((c) => {
//         const { _id, __v, ...contact } = c.toObject();
//         return { ...contact };
//       }),
//       skipped: skippedContacts,
//     });
//   } catch (error) {
//     console.error("Bulk contact save error:", error);
//     return res.status(500).json({
//       status: "error",
//       message: "Something went wrong",
//     });
//   }
// };

// module.exports = { saveBulkContacts };
const Contact = require("../models/contactModel");
const User = require("../models/userModel");
const mongoose = require("mongoose");

const saveBulkContacts = async (req, res) => {
  try {
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

    for (const contact of contacts) {
      const invalidKeys = Object.keys(contact).filter(
        (key) => !allowedFields.includes(key)
      );
      if (invalidKeys.length > 0) {
        return res.status(400).json({
          status: "error",
          message: `Invalid columns: ${invalidKeys.join(", ")}`,
        });
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

      const parsedPhones = Array.isArray(phonenumbers)
        ? phonenumbers.map((num) => String(num).replace(/[^\d]/g, ""))
        : [String(phonenumbers).replace(/[^\d]/g, "")];

      const phoneList = parsedPhones.filter((n) => n);
      const emailList = Array.isArray(emailaddresses)
        ? emailaddresses.filter((e) => e)
        : emailaddresses
          ? [emailaddresses]
          : [];

      const existingContact = await Contact.findOne({
        createdBy: req.user._id,
        $or: [
          { phonenumbers: { $in: phoneList } },
          { emailaddresses: { $in: emailList } },
        ],
      });

      // No existing contact: Create new
      if (!existingContact) {
        const generatedId = new mongoose.Types.ObjectId();
        newContacts.push({
          _id: generatedId,
          contact_id: generatedId,
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
          activities: [{
            action: 'contact_created',
            type: 'contact',
            title: 'Contact Imported',
            description: `${firstname} ${lastname}`,
          }],
          createdBy: req.user._id,
        });
        continue;
      }

      // Compare core fields for exact match
      const existingObj = existingContact.toObject();

      const coreFieldsSame =
        JSON.stringify({
          firstname,
          lastname,
          company,
          designation,
          linkedin,
          instagram,
          telegram,
          twitter,
          facebook,
        }) ===
        JSON.stringify({
          firstname: existingObj.firstname || "",
          lastname: existingObj.lastname || "",
          company: existingObj.company || "",
          designation: existingObj.designation || "",
          linkedin: existingObj.linkedin || "",
          instagram: existingObj.instagram || "",
          telegram: existingObj.telegram || "",
          twitter: existingObj.twitter || "",
          facebook: existingObj.facebook || "",
        });

      const existingPhones = existingObj.phonenumbers || [];
      const existingEmails = existingObj.emailaddresses || [];

      const newPhones = phoneList.filter(
        (p) => !existingPhones.includes(p)
      );
      const newEmails = emailList.filter(
        (e) => !existingEmails.includes(e)
      );

      const hasNewContactData = newPhones.length > 0 || newEmails.length > 0;

      if (coreFieldsSame && !hasNewContactData) {
        skippedContacts.push(contact); // Everything same → skip
        continue;
      }

      if (!hasNewContactData) {
        skippedContacts.push(contact); // No new phone/email → skip
        continue;
      }

      // Update with new phone/email only if present
      const updated = await Contact.findByIdAndUpdate(
        existingContact._id,
        {
          $addToSet: {
            phonenumbers: { $each: newPhones },
            emailaddresses: { $each: newEmails },
          },
          $set: {
            firstname: firstname || existingContact.firstname,
            lastname: lastname || existingContact.lastname,
            company: company || existingContact.company,
            designation: designation || existingContact.designation,
            linkedin: linkedin || existingContact.linkedin,
            instagram: instagram || existingContact.instagram,
            telegram: telegram || existingContact.telegram,
            twitter: twitter || existingContact.twitter,
            facebook: facebook || existingContact.facebook,
          },
        },
        { new: true }
      );

      updatedContacts.push(updated);
    }

    // Insert new contacts
    const inserted = newContacts.length
      ? await Contact.insertMany(newContacts)
      : [];

    return res.status(201).json({
      status: "success",
      message: `Processed ${contacts.length} contact(s): ${inserted.length} added, ${updatedContacts.length} updated, ${skippedContacts.length} skipped.`,
      data: {
        added: inserted.map((c) => {
          const { _id, __v, ...data } = c.toObject();
          return data;
        }),
        updated: updatedContacts.map((c) => {
          const { _id, __v, ...data } = c.toObject();
          return data;
        }),
        skipped: skippedContacts,
      },
    });
  } catch (error) {
    console.error("Bulk contact save error:", error);
    return res.status(500).json({
      status: "error",
      message: "Something went wrong",
    });
  }
};

module.exports = { saveBulkContacts };