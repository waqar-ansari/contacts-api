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

    // Get current highest order value
    let maxOrder = user.tags.length > 0
      ? Math.max(...user.tags.map(t => t.order || 0))
      : 0;

    for (const item of tagsArray) {
      const tagText = item.tag?.trim();
      const emoji = item.emoji?.trim() || "";

      if (!tagText) continue;

      const lowerTagText = tagText.toLowerCase();
      if (existingTagMap.has(lowerTagText)) {
        skippedTags.push(lowerTagText);
        continue;
      }

      maxOrder++; // increment order

      const newTag = {
        tag_id: new mongoose.Types.ObjectId(),
        tag: tagText,
        emoji,
        order: maxOrder,
      };

      user.tags.push(newTag);
      newTags.push(newTag);
    }

    await user.save();

    return res.status(200).json({
      status: "success",
      message: "Tags Added",
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


