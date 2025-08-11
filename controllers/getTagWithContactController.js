const mongoose = require("mongoose");
const User = require("../models/userModel");
const Contact = require("../models/contactModel");

const getTagWithContact = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({
                status: "error",
                message: "User not found"
            });
        }

        // Fetch all user tags
        const userTags = user.tags;

        // For each tag, fetch contacts that have it
        const tagsWithContacts = await Promise.all(
            userTags.map(async (tag) => {
                const contacts = await Contact.find({
                    createdBy: req.user._id,
                    "tags.tag_id": tag.tag_id
                }).select("_id firstname lastname emailaddresses phonenumbers contactImageURL"); // select only needed fields
                console.log("Contacts with tag:",  contacts);

                return {
                    tag_id: tag.tag_id,
                    tag: tag.tag,
                    emoji: tag.emoji,
                    contacts // array of contacts with this tag
                };
            })
        );

        res.status(200).json({
            status: "success",
            message: "Tags with contacts fetched successfully",
            data: tagsWithContacts
        });
    } catch (error) {
        console.error("Error fetching tags:", error);
        res.status(500).json({
            status: "error",
            message: "Error fetching the tags"
        });
    }
};

module.exports = { getTagWithContact };
