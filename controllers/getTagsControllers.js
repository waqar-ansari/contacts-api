const User = require("../models/userModel");

const getTags = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" , status: "error"});
    }
    const userTags = user.tags.map((tag) => ({
      tag_id: tag.tag_id,
      tag: tag.tag,
    }));

    res.status(200).json({ userTags, status: "success" });
  } catch {
    res.status(500).json({ message: "Error fetching the tags",status: "error" });
  }
};

module.exports = { getTags };