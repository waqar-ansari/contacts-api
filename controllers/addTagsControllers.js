const { mongoose } = require("mongoose");
const User = require("../models/userModel");

const addTags = async (req, res) => {
  try {
    const { tag } = req.body;

    if (!tag || !Array.isArray(tag) || tag.length === 0) {
      return res
        .status(400)
        .json({ status: "error", message: "Please provide an array of tags" });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res
        .status(404)
        .json({ status: "error", message: "User not found" });
    }

    // Normalize input tags
    const inputTags = tag.map(t => t.trim().toLowerCase());

    // Get existing tag values from the user
    const existingTags = user.tags.map(t => t.tag.toLowerCase());

    const newTags = [];

    inputTags.forEach(t => {
      if (!existingTags.includes(t)) {
        const newTag = {
          tag: t,
          tag_id: new mongoose.Types.ObjectId(),
        };
        user.tags.push(newTag);
        newTags.push(newTag);
      }
    });

    if (newTags.length > 0) {
      await user.save();
    }

    res.status(200).json({
      status: "success",
      message: "tag added successfully",
      data: newTags,
    });

  } catch (error) {
    console.error("Add Tags Error:", error);
    res.status(500).json({ status: "error", message: "Error adding tags" });
  }
};

module.exports = { addTags };
