// controllers/contactController.js
const Contact = require('../models/contactModel');

const deleteAllContacts = async (req, res) => {
  try {
    const userId = req.user._id; // ✅ Set by auth middleware

    const result = await Contact.deleteMany({ createdBy: userId });

    return res.status(200).json({
      status: 'success',
      message: `${result.deletedCount} Contacts Deleted`,
    });
  } catch (error) {
    console.error('Error deleting contacts:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to delete contacts',
    });
  }
};

module.exports = { deleteAllContacts };
