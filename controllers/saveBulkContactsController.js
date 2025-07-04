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

    const bulkPayload = [];
    const skippedContacts = [];

    for (const contact of contacts) {
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
      } = contact;

      const parsedPhones = Array.isArray(phonenumbers)
        ? phonenumbers.map((num) => String(num).replace(/[^\d]/g, ""))
        : [String(phonenumbers).replace(/[^\d]/g, "")];

      const emailList = Array.isArray(emailaddresses)
        ? emailaddresses
        : emailaddresses
        ? [emailaddresses]
        : [];
      const phoneList = parsedPhones;

      let isDuplicate = false;
      if (emailList.length || phoneList.length) {
        const duplicateQuery = {
          createdBy: req.user._id,
          $or: [],
        };
        if (emailList.length) {
          duplicateQuery.$or.push({ emailaddresses: { $in: emailList } });
        }
        if (phoneList.length) {
          duplicateQuery.$or.push({ phonenumbers: { $in: phoneList } });
        }
        if (duplicateQuery.$or.length > 0) {
          const existing = await Contact.findOne(duplicateQuery);
          if (existing) isDuplicate = true;
        }
      }

      if (isDuplicate) {
        skippedContacts.push(contact);
        continue;
      }

      const generatedId = new mongoose.Types.ObjectId();
      bulkPayload.push({
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
        emailaddresses,
        phonenumbers: parsedPhones,
        createdBy: req.user._id,
      });
    }

    const savedContacts = await Contact.insertMany(bulkPayload);

    return res.status(201).json({
      status: "success",
      message: "Contacts added successfully",
      data: savedContacts.map((c) => {
        const { _id, __v, ...contact } = c.toObject();
        return { ...contact };
      }),
      skipped: skippedContacts,
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
