const { mongoose } = require("mongoose");
const User = require("../models/userModel");

const editTag = async (req, res) => {
    try {
        const { tag_id, tag, emoji } = req.body;

        if (!tag_id || !tag?.trim()) {
            return res.status(400).json({
                status: "error",
                message: "Please provide tag_id and tag text",
            });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({
                status: "error",
                message: "User not found",
            });
        }

        const index = user.tags.findIndex(t => t.tag_id.toString() === tag_id);
        if (index === -1) {
            return res.status(404).json({
                status: "error",
                message: "Tag not found",
            });
        }

        user.tags[index].tag = tag.trim();
        user.tags[index].emoji = emoji?.trim() || "";

        await user.save();

        return res.status(200).json({
            status: "success",
            message: "Tag Updated",
            data: [user.tags[index]],
        });
    } catch (error) {
        console.error("Edit Tag Error:", error);
        return res.status(500).json({
            status: "error",
            message: "Error editing tag",
            error: error.message,
        });
    }
};

module.exports = { editTag };