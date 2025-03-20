const Contact = require("../models/contactModel");

const deleteContact = async (req, res) => {
  try {
    const { contact_id } = req.body;

    const contact = await Contact.findOneAndDelete({_id:contact_id});
    if (!contact) {
      return res.status(404).json({ message: "Contact not found", status: "error" });
    }
    res
      .status(200)
      .json({ message: "Contact Deleted Successfully", status: "success" });
  } catch {
    res.status(500).json({ message: "Error deleting contact", status: "error" });
  }
};

module.exports = { deleteContact };
