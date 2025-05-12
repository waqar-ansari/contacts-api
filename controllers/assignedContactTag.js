const mongoose = require('mongoose');
const Contact = require("../models/contactModel");

// Assign multiple tags
const assignTagToContact = async (req, res) => {
  const { contactId, tagNames } = req.body;

  if (!contactId || !Array.isArray(tagNames) || tagNames.length === 0) {
    return res.status(400).json({ status: "error", message: 'contactId and tagNames are required' });
  }

  try {
    const contact = await Contact.findById(contactId);
    if (!contact) {
      return res.status(404).json({ status: "error", message: 'Contact not found' });
    }

    let addedTags = [];

    tagNames.forEach(tagName => {
      const tagExists = contact.tags.some(
        (t) => t.tag && t.tag.toLowerCase() === tagName.toLowerCase()
      );

      if (!tagExists) {
        contact.tags.push({
          tag_id: new mongoose.Types.ObjectId(),
          tag: tagName,
        });
        addedTags.push(tagName);
      }
    });

    await contact.save();

    res.status(200).json({
      status: "success",
      message: addedTags.length > 0 ? 'Tags assigned successfully' : 'tags are already assigned',
      data: contact,
    });
  } catch (err) {
    console.error('Error assigning tags:', err);
    res.status(500).json({ status: "error", message: 'Internal server error' });
  }
};

// Unassign multiple tags
const unassignTagFromContact = async (req, res) => {
  const { contactId, tagNames } = req.body;

  if (!contactId || !Array.isArray(tagNames) || tagNames.length === 0) {
    return res.status(400).json({ status: "error", message: 'contactId and tagNames (array) are required' });
  }

  try {
    const contact = await Contact.findById(contactId);
    if (!contact) {
      return res.status(404).json({ status: "error", message: 'Contact not found' });
    }

    const originalTags = contact.tags.map((t) => t.tag.toLowerCase());
    const removedTags = [];

    contact.tags = contact.tags.filter((t) => {
      const shouldRemove = tagNames.includes(t.tag.toLowerCase());
      if (shouldRemove) removedTags.push(t.tag);
      return !shouldRemove;
    });

    if (removedTags.length === 0) {
      return res.status(404).json({ status: "error", message: 'No matching tags found to unassign' });
    }

    await contact.save();

    res.status(200).json({
      status: "success",
      message: 'Tags unassigned successfully',
      data: contact,
    });
  } catch (err) {
    console.error('Error unassigning tags:', err);
    res.status(500).json({ status: "error", message: 'Internal server error' });
  }
};

module.exports = { assignTagToContact, unassignTagFromContact };