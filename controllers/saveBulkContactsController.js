const Contact = require("../models/contactModel");
const User = require("../models/userModel");
const mongoose = require("mongoose");
const { parsePhoneNumberFromString } = require("libphonenumber-js");


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

      // const parsedPhones = Array.isArray(phonenumbers)
      //   ? phonenumbers.map((num) => String(num).replace(/[^\d]/g, ""))
      //   : [String(phonenumbers).replace(/[^\d]/g, "")];

      let phoneList = [];

      // if (Array.isArray(phonenumbers)) {
      //   for (const num of phonenumbers) {
      //     if (!num) continue;

      //     let phoneObj = { countryCode: "", number: "" };

      //     // if request already sends structured object { countryCode, number }
      //     if (typeof num === "object" && num.number) {
      //       phoneObj.countryCode = num.countryCode || "";
      //       phoneObj.number = String(num.number).replace(/[^\d]/g, "");
      //     } else {
      //       // if plain number, try to parse
      //       const parsed = parsePhoneNumberFromString(String(num));
      //       if (parsed) {
      //         phoneObj.countryCode = parsed.countryCallingCode || "";
      //         phoneObj.number = parsed.nationalNumber || String(num).replace(/[^\d]/g, "");
      //       } else {
      //         phoneObj.number = String(num).replace(/[^\d]/g, "");
      //       }
      //     }

      //     if (phoneObj.number) phoneList.push(phoneObj);
      //   }
      // }
      if (Array.isArray(phonenumbers) && phonenumbers.length > 0) {
        const num = phonenumbers[0]; // ✅ only take first number

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
          phoneObj.number = parsed.nationalNumber || String(phonenumbers).replace(/[^\d]/g, "");
        } else {
          phoneObj.number = String(phonenumbers).replace(/[^\d]/g, "");
        }
        if (phoneObj.number) phoneList.push(phoneObj);
      }


      // const phoneList = parsedPhones.filter((n) => n);
      const emailList = Array.isArray(emailaddresses)
        ? emailaddresses.filter((e) => e)
        : emailaddresses
          ? [emailaddresses]
          : [];

      const existingContact = await Contact.findOne({
        createdBy: req.user._id,
        $or: [
          // { phonenumbers: { $in: phoneList } },
          { phonenumbers: { $elemMatch: { number: { $in: phoneList.map(p => p.number) } } } },
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

      // const newPhones = phoneList.filter(
      //   (p) => !existingPhones.includes(p)
      // );
      const newPhones = phoneList.filter(
        (p) => !existingPhones.some(ep => ep.number === p.number && ep.countryCode === p.countryCode)
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