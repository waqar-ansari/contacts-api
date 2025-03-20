const User = require("../models/userModel");

const getTags = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res
        .status(404)
        .json({ status: "error", message: "User not found" });
    }
    const userTags = user.tags.map((tag) => ({
      tag_id: tag.tag_id,
      tag: tag.tag,
    }));

    res
      .status(200)
      .json({
        status: "success",
        message: "Tags fetched sucessfully",
        data: userTags,
      });
  } catch {
    res
      .status(500)
      .json({ status: "error", message: "Error fetching the tags" });
  }
};

module.exports = { getTags };
