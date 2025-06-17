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

const addEditTag = async (req, res) => {
  try {
    const tagsArray = req.body;

    if (!Array.isArray(tagsArray) || tagsArray.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "Please provide an array of tags",
      });
    }

    // ✅ Find user
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    const existingTags = user.tags.map((t) => t.tag.toLowerCase());
    const newTags = [];
    const updatedTags = [];
    const skippedTags = [];

    for (const item of tagsArray) {
      const tagText = item.tag?.trim();
      const emoji = item.emoji || "";
      const tagId = item.tag_id;

      if (!tagText) continue;

      if (tagId) {
        // 🔁 Edit existing tag
        const index = user.tags.findIndex(t => t.tag_id.toString() === tagId);
        if (index !== -1) {
          user.tags[index].tag = tagText;
          user.tags[index].icon = emoji;
          updatedTags.push(user.tags[index]);
        } else {
          skippedTags.push(tagText);
        }
      } else {
        // ➕ Add new tag if not duplicate
        const lowerTagText = tagText.toLowerCase();
        if (existingTags.includes(lowerTagText)) {
          skippedTags.push(lowerTagText);
          continue;
        }

        const newTag = {
          tag_id: new mongoose.Types.ObjectId(),
          tag: tagText,
          icon: emoji,
        };

        user.tags.push(newTag);
        newTags.push(newTag);
      }
    }

    await user.save();

    return res.status(200).json({
      status: "success",
      message: "Tags processed successfully",
      data: {
        tagAdded: newTags,
        tagUpdated: updatedTags,
        // skipped: skippedTags,
      }

    });
  } catch (error) {
    console.error("Add/Edit Tags Error:", error);
    return res.status(500).json({
      status: "error",
      message: "Error processing tags",
      error: error.message,
    });
  }
};

module.exports = { addEditTag };


