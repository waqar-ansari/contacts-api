const Contact = require("../models/contactModel");

const deleteContact = async (req, res) => {
  try {
    const { contact_id } = req.body;

    const contact = await Contact.findOneAndDelete({_id:contact_id});
    if (!contact) {
      return res.status(404).json({ status: "error", message: "Contact not found" });
    }
    res
      .status(200)
      .json({ status: "success", message: "Contact Deleted Successfully" });
  } catch {
    res.status(500).json({ status: "error", message: "Error deleting contact" });
  }
};

module.exports = { deleteContact };
