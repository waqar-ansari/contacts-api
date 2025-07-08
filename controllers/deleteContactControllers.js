// const Contact = require("../models/contactModel");

// const deleteContact = async (req, res) => {
//   try {
//     const { contact_id } = req.body;

//     const contact = await Contact.findOneAndDelete({ _id: contact_id });
//     if (!contact) {
//       return res.status(404).json({ status: "error", message: "Contact not found" });
//     }
//     res
//       .status(200)
//       .json({ status: "success", message: "Contact Deleted Successfully", data: { contact_id: contact_id } });
//   } catch {
//     res.status(500).json({ status: "error", message: "Error deleting contact" });
//   }
// };

// module.exports = { deleteContact };

const Contact = require("../models/contactModel");

const deleteContact = async (req, res) => {
  try {
    const { contact_id } = req.body; // Expecting an array of contact IDs

    if (!Array.isArray(contact_id) || contact_id.length === 0) {
      return res.status(400).json({ status: "error", message: "No contact id provided" });
    }

    const result = await Contact.deleteMany({ _id: { $in: contact_id } });

    if (result.deletedCount === 0) {
      return res.status(404).json({ status: "error", message: "No contacts found to delete" });
    }

    res.status(200).json({
      status: "success",
      message: `contact deleted successfully`,
      data: { deleted_id: contact_id },
    });
  } catch (error) {
    console.error("Error deleting contacts:", error);
    res.status(500).json({ status: "error", message: "Error deleting contacts" });
  }
};

module.exports = { deleteContact };

