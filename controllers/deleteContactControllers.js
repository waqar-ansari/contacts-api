const Contact = require("../models/contactModel");

const deleteContact = async (req, res) => {
  try {
    const { contact_id } = req.body;

    const contact = await Contact.findOneAndDelete(contact_id);
    if (!contact) {
      return res.status(404).json({ message: "Contact not found" });
    }
  } catch {
    res.status(500).json({ message: "Error deleting contact" });
  }
  res.status(200).json({ meassage: "Contact Deleted Successfully" });
};

module.exports = { deleteContact };
