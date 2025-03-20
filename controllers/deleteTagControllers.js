const Contact = require("../models/contactModel");
const User = require("../models/userModel");

const deleteTag = async (req, res) => {
  try {
    const { tag_id } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) {
      return res
        .status(404)
        .json({ status: "error", message: "User not found"});
    }

    if (!tag_id) {
      return res
        .status(404)
        .json({  status: "error",message: "Tag not found", });
    }
    const tag = user.tags.find((tag) => tag.tag_id.toString() === tag_id);
    if (!tag) {
      return res
        .status(404)
        .json({  status: "error",message: "Tag not found" });
    }

    user.tags.pull({ tag_id });
    await Contact.updateMany(
      { "tags.tag_id": tag_id }, // Match contacts having this tag
      { $pull: { tags: { tag_id } } } // Remove the tag from the tags array
    );
    await user.save();
    res
      .status(200)
      .json({  status: "success" ,message: "Tag deleted successfully"});
  } catch {
    res.status(500).send({  status: "error",message: "Error deleting tag"});
  }
};

module.exports = { deleteTag };
