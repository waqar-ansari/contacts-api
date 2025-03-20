const Contact = require("../models/contactModel");

const getContact = async (req, res) => {
  try {
    const contacts = await Contact.find({ createdBy: req?.user?._id }).select('-_id -createdBy -createdAt -updatedAt -__v');
    if (!contacts) {
      return res.status(404).json({ message: "No contacts found",status: "error" });
    }
    res.status(200).json({ data:contacts, message: "Contacts fetched successfully",status: "success" });
  } catch {
    res.status(500).json({ message: "Error fetching contacts",status: "error" });
  }
};

module.exports = { getContact };
