const mongoose = require("mongoose");
const Contact = require("../models/contactModel");
const User = require("../models/userModel");

// Assign existing user-defined tags to a contact
// const assignTagToContact = async (req, res) => {
//   const { contactId, tagNames } = req.body;

//   if (!contactId || !Array.isArray(tagNames) || tagNames.length === 0) {
//     return res.status(400).json({ status: "error", message: "contactId and tagNames are required" });
//   }

//   try {
//     const contact = await Contact.findById(contactId);
//     if (!contact) {
//       return res.status(404).json({ status: "error", message: "Contact not found" });
//     }

//     const user = await User.findById(contact.createdBy);
//     if (!user || !user.tags) {
//       return res.status(404).json({ status: "error", message: "User or user tags not found" });
//     }

//     const userTags = user.tags;
//     const addedTags = [];
//     const notFoundTags = [];


//     for (const tagName of tagNames) {
//       const matchingUserTag = userTags.find(
//         (t) =>
//           t &&
//           typeof t.tag === "string" &&
//           t.tag.toLowerCase().trim() === tagName.toLowerCase().trim()
//       );


//       if (!matchingUserTag || !matchingUserTag.tag_id) {
//         notFoundTags.push(tagName);
//         continue;
//       }

//       const alreadyAssigned = contact.tags.some(
//         (t) => t.tag_id && t.tag_id.toString() === matchingUserTag.tag_id.toString()
//       );

//       if (!alreadyAssigned) {
//         contact.tags.push({
//           tag_id: matchingUserTag.tag_id,
//           tag: matchingUserTag.tag,
//         });
//         addedTags.push(matchingUserTag.tag);
//       }
//     }

//     await contact.save();

//     return res.status(200).json({
//       status: "success",
//       message:
//         addedTags.length > 0
//           ? "Tags assigned successfully"
//           : notFoundTags.length > 0
//             ? "No matching user tags found"
//             : "All tags were already assigned",
//       data: {
//         ...contact.toObject(),
//         addedTags,
//         notFoundTags,
//       },
//     });
//   } catch (err) {
//     console.error("Error assigning tags:", err);
//     return res.status(500).json({ status: "error", message: "Internal server error" });
//   }
// };

const assignTagToContact = async (req, res) => {
  const { contactIds, tagId } = req.body;

  if (!Array.isArray(contactIds) || contactIds.length === 0 || !tagId) {
    return res.status(400).json({
      status: "error",
      message: "contactIds (array) and tagId are required",
    });
  }

  try {
    // 1️⃣ Find the tag in the logged-in user's tags
    const user = await User.findById(req.user._id);
    if (!user || !user.tags) {
      return res.status(404).json({
        status: "error",
        message: "User or user tags not found",
      });
    }

    const matchingTag = user.tags.find(
      (t) => t.tag_id && t.tag_id.toString() === tagId.toString()
    );

    if (!matchingTag) {
      return res.status(404).json({
        status: "error",
        message: "Tag not found in your account",
      });
    }

    // Tag object to assign
    const tagToAssign = {
      tag_id: matchingTag.tag_id,
      tag: matchingTag.tag,
      emoji: matchingTag.emoji || null,
    };

    let assignedContacts = [];

    // 2️⃣ Loop through contact IDs and assign tag
    for (const id of contactIds) {
      const contact = await Contact.findById(id);

      if (!contact) continue; // skip if contact not found

      const alreadyAssigned = contact.tags.some(
        (t) => t.tag_id && t.tag_id.toString() === matchingTag.tag_id.toString()
      );

      if (!alreadyAssigned) {
        contact.tags.push(tagToAssign);
        await contact.save();
        assignedContacts.push(contact);
      }
    }

    // 3️⃣ Response
    return res.status(200).json({
      status: "success",
      message: `Tag ${matchingTag.tag} assigned!`,
      assignedContacts, // Only the ones that got updated
    });

  } catch (err) {
    console.error("Error assigning tag:", err);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};


// Unassign selected tags from a specific contact
// const unassignTagFromContact = async (req, res) => {
//   const { contactId, tagNames } = req.body;

//   if (!contactId || !Array.isArray(tagNames) || tagNames.length === 0) {
//     return res.status(400).json({ status: "error", message: "contactId and tagNames are required" });
//   }

//   try {
//     const contact = await Contact.findById(contactId);
//     if (!contact) {
//       return res.status(404).json({ status: "error", message: "Contact not found" });
//     }

//     const removedTags = [];

//     contact.tags = contact.tags.filter((t) => {
//       const shouldRemove = tagNames.includes(t.tag?.toLowerCase());
//       if (shouldRemove) removedTags.push(t.tag);
//       return !shouldRemove;
//     });

//     if (removedTags.length === 0) {
//       return res.status(404).json({ status: "error", message: "No matching tags found to unassign" });
//     }

//     await contact.save();

//     return res.status(200).json({
//       status: "success",
//       message: "Tags unassigned successfully",
//       data: {
//         ...contact.toObject(),
//         contact_id: contact._id,
//       },
//     });
//   } catch (err) {
//     console.error("Error unassigning tags:", err);
//     return res.status(500).json({ status: "error", message: "Internal server error" });
//   }
// };

const unassignTagFromContact = async (req, res) => {
  const { contactIds, tagId } = req.body;

  if (!Array.isArray(contactIds) || contactIds.length === 0 || !tagId) {
    return res.status(400).json({
      status: "error",
      message: "contactIds (array) and tagId are required",
    });
  }

  try {
    // 1️⃣ Check if tag exists in user's tags
    const user = await User.findById(req.user._id);
    if (!user || !user.tags) {
      return res.status(404).json({
        status: "error",
        message: "User or user tags not found",
      });
    }

    const matchingTag = user.tags.find(
      (t) => t.tag_id && t.tag_id.toString() === tagId.toString()
    );

    if (!matchingTag) {
      return res.status(404).json({
        status: "error",
        message: "Tag not found in your account",
      });
    }

    let updatedContacts = [];

    // 2️⃣ Loop through contact IDs and remove the tag
    for (const id of contactIds) {
      const contact = await Contact.findById(id);
      if (!contact) continue;

      const originalLength = contact.tags.length;

      // Remove matching tag_id
      contact.tags = contact.tags.filter(
        (t) => t.tag_id && t.tag_id.toString() !== matchingTag.tag_id.toString()
      );

      if (contact.tags.length < originalLength) {
        await contact.save();
        updatedContacts.push(contact);
      }
    }

    // 3️⃣ Response
    if (updatedContacts.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "No matching tags found to unassign in given contacts",
      });
    }

    return res.status(200).json({
      status: "success",
      message: `Tag ${matchingTag.tag} unassigned!`,
      updatedContacts,
    });

  } catch (err) {
    console.error("Error unassigning tag:", err);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};


module.exports = { assignTagToContact, unassignTagFromContact };
