const Contact = require("../models/contactModel");

const getContact = async (req, res) => {
  try {
    const contacts = await Contact.find({ createdBy: req?.user?._id }).select('-_id -createdBy -createdAt -updatedAt -__v');
    res.status(200).json({ data:contacts });
  } catch {
    res.status(500).json({ message: "Error fetching contacts" });
  }
};

module.exports = { getContact };
