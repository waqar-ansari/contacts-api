const mongoose = require('mongoose');
const Contact = require("../models/contactModel");

const assignTagToContact = async (req, res) => {
  const { contactId, tagName } = req.body;

  if (!contactId || !tagName) {
    return res.status(400).json({ message: 'contactId and tagName are required' });
  }

  try {
    const contact = await Contact.findById(contactId);
    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    // Check if tag already exists by tag name
    const tagExists = contact.tags.some(
      (t) => t.tag && t.tag.toLowerCase() === tagName.toLowerCase()
    );

    if (tagExists) {
      return res.status(200).json({ message: 'Tag already assigned', contact });
    }

    // Add new tag
    contact.tags.push({
      tag_id: new mongoose.Types.ObjectId(),
      tag: tagName,
    });

    await contact.save();

    res.status(200).json({
      message: 'Tag assigned successfully',
      contact,
    });
  } catch (err) {
    console.error('Error assigning tag:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { assignTagToContact };
