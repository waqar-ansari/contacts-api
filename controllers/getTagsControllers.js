const User = require("../models/userModel");

const getTags = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const userTags = user.tags.map((tag) => ({
      tag_id: tag.tag_id,
      tag: tag.tag,
    }));

    res.status(200).json({ userTags });
  } catch {
    res.status(500).json({ message: "Error fetching the tags" });
  }
};

module.exports = { getTags };
