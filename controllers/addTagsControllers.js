const { mongoose } = require("mongoose");
const User = require("../models/userModel");

const addTags = async (req, res) => {
  try {
    const { tag } = req.body;
    if (!tag) {
      return res
        .status(400)
        .json({ status: "error", message: "Please provide a tag" });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res
        .status(404)
        .json({ status: "error", message: "User not found" });
    }

    const newTag = {
      tag,
      tag_id: new mongoose.Types.ObjectId(),
    };

    user.tags.push(newTag);

    await user.save();

    res
      .status(200)
      .json({
        status: "success",
        message: "Tag added successfully",
        data: newTag,
      });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Error adding tag" });
  }
};

module.exports = { addTags };
