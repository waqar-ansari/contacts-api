// const mongoose = require("mongoose");
// const Contact = require("../models/contactModel");
// const User = require("../models/userModel");

// const assignOrUnassignTag = async (req, res) => {
//   const { tagId, add = [], remove = [] } = req.body;

//   if (!tagId) {
//     return res.status(400).json({
//       status: "error",
//       message: "tagId is required",
//     });
//   }

//   if (!Array.isArray(add) || !Array.isArray(remove)) {
//     return res.status(400).json({
//       status: "error",
//       message: "add and remove must be arrays",
//     });
//   }

//   try {
//     // 1️⃣ Find the tag in the logged-in user's tags
//     const user = await User.findById(req.user._id);
//     if (!user || !user.tags) {
//       return res.status(404).json({
//         status: "error",
//         message: "User or user tags not found",
//       });
//     }

//     const matchingTag = user.tags.find(
//       (t) => t.tag_id && t.tag_id.toString() === tagId.toString()
//     );

//     if (!matchingTag) {
//       return res.status(404).json({
//         status: "error",
//         message: "Tag not found in your account",
//       });
//     }

//     const tagToProcess = {
//       tag_id: matchingTag.tag_id,
//       tag: matchingTag.tag,
//       emoji: matchingTag.emoji || null,
//     };

//     let assignedContacts = [];
//     let unassignedContacts = [];

//     // 2️⃣ Assign tag to "add" contacts
//     for (const id of add) {
//       const contact = await Contact.findById(id);

//       if (!contact) continue;

//       const alreadyAssigned = contact.tags.some(
//         (t) => t.tag_id && t.tag_id.toString() === matchingTag.tag_id.toString()
//       );

//       if (!alreadyAssigned) {
//         contact.tags.push(tagToProcess);
//         await contact.save();

//         // Fetch updated contact with only required fields
//         const updatedContact = await Contact.findById(id)
//           .select("_id firstname lastname emailaddresses phonenumbers contactImageURL tags");
//         assignedContacts.push(updatedContact);
//       }
//     }

//     // 3️⃣ Remove tag from "remove" contacts
//     for (const id of remove) {
//       const contact = await Contact.findById(id);

//       if (!contact) continue;

//       const beforeCount = contact.tags.length;
//       contact.tags = contact.tags.filter(
//         (t) => t.tag_id.toString() !== matchingTag.tag_id.toString()
//       );

//       if (contact.tags.length !== beforeCount) {
//         await contact.save();

//         // Fetch updated contact with only required fields
//         const updatedContact = await Contact.findById(id)
//           .select("_id firstname lastname emailaddresses phonenumbers contactImageURL tags");
//         unassignedContacts.push(updatedContact);
//       }
//     }

//     // 4️⃣ Response
//     return res.status(200).json({
//       status: "success",
//       message: "Tag operations completed",
//       data: [
//         assignedContacts,
//         unassignedContacts,
//       ]
//     });

//   } catch (err) {
//     console.error("Error in tag assignment/removal:", err);
//     return res.status(500).json({
//       status: "error",
//       message: "Internal server error",
//     });
//   }
// };

// module.exports = { assignOrUnassignTag };

const mongoose = require("mongoose");
const Contact = require("../models/contactModel");
const User = require("../models/userModel");

const assignOrUnassignTag = async (req, res) => {
  const { tagId, add = [], remove = [] } = req.body;

  if (!tagId) {
    return res.status(400).json({
      status: "error",
      message: "tagId is required",
    });
  }

  if (!Array.isArray(add) || !Array.isArray(remove)) {
    return res.status(400).json({
      status: "error",
      message: "add and remove must be arrays",
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

    const tagToProcess = {
      tag_id: matchingTag.tag_id,
      tag: matchingTag.tag,
      emoji: matchingTag.emoji || null,
    };

    // 2️⃣ Assign tag to "add" contacts
    for (const id of add) {
      const contact = await Contact.findById(id);
      if (!contact) continue;

      const alreadyAssigned = contact.tags.some(
        (t) => t.tag_id && t.tag_id.toString() === matchingTag.tag_id.toString()
      );

      if (!alreadyAssigned) {
        contact.tags.push(tagToProcess);
        await contact.save();
      }
    }

    // 3️⃣ Remove tag from "remove" contacts
    for (const id of remove) {
      const contact = await Contact.findById(id);
      if (!contact) continue;

      const beforeCount = contact.tags.length;
      contact.tags = contact.tags.filter(
        (t) => t.tag_id.toString() !== matchingTag.tag_id.toString()
      );

      if (contact.tags.length !== beforeCount) {
        await contact.save();
      }
    }

    // 4️⃣ After operations, fetch updated tags with contacts
    const updatedUser = await User.findById(req.user._id);
    const tagsWithContacts = [];

    for (const tag of updatedUser.tags) {
      const contacts = await Contact.find({ "tags.tag_id": tag.tag_id })
        .select("_id firstname lastname emailaddresses phonenumbers contactImageURL");

      tagsWithContacts.push({
        tag_id: tag.tag_id,
        tag: tag.tag,
        emoji: tag.emoji || null,
        contacts
      });
    }

    // 5️⃣ Response
    return res.status(200).json({
      status: "success",
      message: "Tag operations completed",
      data: tagsWithContacts
    });

  } catch (err) {
    console.error("Error in tag assignment/removal:", err);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

module.exports = { assignOrUnassignTag };


