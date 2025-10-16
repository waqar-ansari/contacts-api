const Contact = require("../models/contactModel");
const User = require("../models/userModel");
const mongoose = require("mongoose");


const deleteTag = async (req, res) => {
  try {
    const { tag_id } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) {
      return res
        .status(404)
        .json({ status: "error", message: "User not found" });
    }

    if (!tag_id) {
      return res
        .status(404)
        .json({ status: "error", message: "Tag not found", });
    }
    const tag = user.tags.find((tag) => tag.tag_id.toString() === tag_id);
    if (!tag) {
      return res
        .status(404)
        .json({ status: "error", message: "Tag not found" });
    }

    // // Find the tag object in user.tags by tag_id
    // const tagObject = user.tags.find(
    //   (tag) => tag.tag_id.toString() === tag_id
    // );

    // if (!tagObject) {
    //   return res.status(404).json({
    //     status: "error",
    //     message: "Tag not found in user",
    //   });
    // }

    // const tagName = tagObject.tag; // This is the string stored in contacts

    user.tags.pull({ tag_id });
    await Contact.updateMany(
      { "tags.tag_id": tag_id },
      { $pull: { tags: { tag_id } } }
    );
    await user.save();

    // const contactUpdateResult = await Contact.updateMany(
    //   { tags: tagName },
    //   { $pull: { tags: tagName } }
    // );

    res
      .status(200)
      .json({
        status: "success", message: "Tag Deleted", data: { tag_id }
      });
  } catch {
    res.status(500).send({ status: "error", message: "Error deleting tag" });
  }
};

module.exports = { deleteTag };
