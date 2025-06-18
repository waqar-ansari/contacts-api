// const { mongoose } = require("mongoose");
// const User = require("../models/userModel");

// const addTags = async (req, res) => {
//   try {
//     const tagsArray = req.body;

//     // ✅ Validate array
//     if (!Array.isArray(tagsArray) || tagsArray.length === 0) {
//       return res.status(400).json({
//         status: "error",
//         message: "Please provide an array of tags",
//       });
//     }

//     // ✅ Find user
//     const user = await User.findById(req.user._id);
//     if (!user) {
//       return res.status(404).json({
//         status: "error",
//         message: "User not found",
//       });
//     }

//     // ✅ Normalize existing tags
//     const existingTags = user.tags.map((t) => t.tag.toLowerCase());

//     const newTags = [];
//     const skippedTags = [];

//     for (const item of tagsArray) {
//       const tagText = item.tag?.trim().toLowerCase();
//       const emoji = item.emoji || "";

//       if (!tagText) continue;

//       if (existingTags.includes(tagText)) {
//         skippedTags.push(tagText);
//         continue;
//       }

//       const newTag = {
//         tag: tagText,
//         tag_id: new mongoose.Types.ObjectId(),
//         emoji: emoji, // emoji saved in "icon" field
//       };

//       user.tags.push(newTag);
//       newTags.push(newTag);
//     }

//     if (newTags.length > 0) {
//       await user.save();
//     }

//     return res.status(200).json({
//       status: "success",
//       message: "Tags added successfully",
//       data: newTags,
//       // skipped: skippedTags,
//     });
//   } catch (error) {
//     console.error("Add Tags Error:", error);
//     return res.status(500).json({
//       status: "error",
//       message: "Error adding tags",
//       error: error.message,
//     });
//   }
// };

// module.exports = { addTags };

const { mongoose } = require("mongoose");
const User = require("../models/userModel");

const addTag = async (req, res) => {
  try {
    const tagsArray = req.body;

    if (!Array.isArray(tagsArray) || tagsArray.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "Please provide an array of tags",
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    const existingTagMap = new Map(user.tags.map(t => [t.tag.toLowerCase(), true]));
    const newTags = [];
    const skippedTags = [];

    for (const item of tagsArray) {
      const tagText = item.tag?.trim();
      const emoji = item.emoji?.trim() || "";

      if (!tagText) continue;

      const lowerTagText = tagText.toLowerCase();
      if (existingTagMap.has(lowerTagText)) {
        skippedTags.push(lowerTagText);
        continue;
      }

      const newTag = {
        tag_id: new mongoose.Types.ObjectId(),
        tag: tagText,
        emoji,
      };

      user.tags.push(newTag);
      newTags.push(newTag);
    }

    await user.save();

    return res.status(200).json({
      status: "success",
      message: "Tags added successfully",
      data: newTags,
    });
  } catch (error) {
    console.error("Add Tags Error:", error);
    return res.status(500).json({
      status: "error",
      message: "Error adding tags",
      error: error.message,
    });
  }
};


module.exports = { addTag };


