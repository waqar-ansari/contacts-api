const Contact = require("../models/contactModel");

const getContact = async (req, res) => {
  try {
    const contacts = await Contact.find({ createdBy: req?.user?._id });

    res.status(200).json({ contacts });
  } catch {
    res.status(500).json({ message: "Error fetching contacts" });
  }
};

module.exports = { getContact };
