const Contact = require("../models/contactModel");
const User = require("../models/userModel");

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

    const bulkPayload = contacts.map((contact) => {
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

      return {
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
      };
    });

    const savedContacts = await Contact.insertMany(bulkPayload);
console.log(savedContacts,"bulk saved contacts");

    return res.status(201).json({
      status: "success",
      message: "Contacts saved successfully",
      data: savedContacts,
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
