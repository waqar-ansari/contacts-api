const { mongoose } = require("mongoose");
const User = require("../models/userModel");

const addTags = async (req, res) => {
  try {
    const tagsArray = req.body;

    // ✅ Validate array
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

    // ✅ Normalize existing tags
    const existingTags = user.tags.map((t) => t.tag.toLowerCase());

    const newTags = [];
    const skippedTags = [];

    for (const item of tagsArray) {
      const tagText = item.tag?.trim().toLowerCase();
      const emoji = item.emoji || "";

      if (!tagText) continue;

      if (existingTags.includes(tagText)) {
        skippedTags.push(tagText);
        continue;
      }

      const newTag = {
        tag: tagText,
        tag_id: new mongoose.Types.ObjectId(),
        emoji: emoji, // emoji saved in "icon" field
      };

      user.tags.push(newTag);
      newTags.push(newTag);
    }

    if (newTags.length > 0) {
      await user.save();
    }

    return res.status(200).json({
      status: "success",
      message: "Tags added successfully",
      data: newTags,
      // skipped: skippedTags,
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

module.exports = { addTags };

