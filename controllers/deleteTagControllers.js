const User = require("../models/userModel");

const deleteTag = async (req, res) => {
  try {
    const { tag_id } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!tag_id) {
      return res.status(404).json({ message: "Tag not found" });
    }
    const tag = user.tags.find((tag) => tag.tag_id.toString() === tag_id);
    if (!tag) {
      return res.status(404).json({ message: "Tag not found" });
    }

    user.tags.pull({ tag_id });
    await user.save();
    res.json({ message: "Tag deleted successfully" });
  } catch {
    res.status(500).send({ message: "Error deleting tag" });
  }
};

module.exports = { deleteTag };
