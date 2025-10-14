// const mongoose = require("mongoose");
// const User = require("../models/userModel");
// const Contact = require("../models/contactModel");

// const getTagWithContact = async (req, res) => {
//     try {
//         const user = await User.findById(req.user._id);
//         if (!user) {
//             return res.status(404).json({
//                 status: "error",
//                 message: "User not found"
//             });
//         }

//         // Fetch all user tags
//         const userTags = user.tags;

//         // For each tag, fetch contacts that have it
//         const tagsWithContacts = await Promise.all(
//             userTags.map(async (tag) => {
//                 const contacts = await Contact.find({
//                     createdBy: req.user._id,
//                     "tags.tag_id": tag.tag_id
//                 }).select("_id firstname lastname emailaddresses phonenumbers contactImageURL"); // select only needed fields
//                 console.log("Contacts with tag:",  contacts);

//                 return {
//                     tag_id: tag.tag_id,
//                     tag: tag.tag,
//                     emoji: tag.emoji,
//                     contacts // array of contacts with this tag
//                 };
//             })
//         );

//         res.status(200).json({
//             status: "success",
//             message: "Tags with contacts fetched successfully",
//             data: tagsWithContacts
//         });
//     } catch (error) {
//         console.error("Error fetching tags:", error);
//         res.status(500).json({
//             status: "error",
//             message: "Error fetching the tags"
//         });
//     }
// };

// module.exports = { getTagWithContact };

const mongoose = require("mongoose");
const User = require("../models/userModel");
const Contact = require("../models/contactModel");

const getTagWithContact = async (req, res) => {
    try {
        const { tag_id, order } = req.body; // accept optional params

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({
                status: "error",
                message: "User not found",
            });
        }

        // ========== CASE 1: When tag_id and order are provided (Update order) ==========
        if (tag_id && typeof order === "number") {
            const tagIndex = user.tags.findIndex(
                (t) => t.tag_id.toString() === tag_id
            );
            if (tagIndex === -1) {
                return res.status(404).json({
                    status: "error",
                    message: "Tag not found in user model",
                });
            }

            // Sort existing tags by their current order or index
            user.tags = user.tags.map((t, idx) => ({ ...t.toObject(), order: t.order ?? idx + 1 }));

            // Remove the tag to be reordered
            const [movedTag] = user.tags.splice(tagIndex, 1);

            // If order > tags.length, place at end
            const newOrderPosition =
                order > user.tags.length ? user.tags.length : order - 1;

            // Reinsert tag at new position
            user.tags.splice(newOrderPosition, 0, movedTag);

            // Reassign all orders sequentially
            user.tags = user.tags.map((t, idx) => ({
                ...t,
                order: idx + 1,
            }));

            await user.save();

            // Update all contacts that have this tag with new order
            await Contact.updateMany(
                { createdBy: req.user._id, "tags.tag_id": tag_id },
                { $set: { "tags.$[elem].order": newOrderPosition + 1 } },
                { arrayFilters: [{ "elem.tag_id": new mongoose.Types.ObjectId(tag_id) }] }
            );

            console.log(`Tag ${tag_id} moved to order ${newOrderPosition + 1}`);

            // Fetch updated data again
        }

        // ========== CASE 2: Return all tags with their contacts ==========
        const userTags = user.tags.sort((a, b) => (a.order || 0) - (b.order || 0));

        const tagsWithContacts = await Promise.all(
            userTags.map(async (tag) => {
                const contacts = await Contact.find({
                    createdBy: req.user._id,
                    "tags.tag_id": tag.tag_id,
                }).select(
                    "_id firstname lastname emailaddresses phonenumbers contactImageURL tags.order"
                );

                return {
                    tag_id: tag.tag_id,
                    tag: tag.tag,
                    emoji: tag.emoji,
                    order: tag.order || null,
                    contacts,
                };
            })
        );

        return res.status(200).json({
            status: "success",
            message: tag_id
                ? "Tag order updated and tags fetched successfully"
                : "Tags with contacts fetched successfully",
            data: tagsWithContacts,
        });
    } catch (error) {
        console.error("Error in getTagWithContact:", error);
        return res.status(500).json({
            status: "error",
            message: "Error processing request",
            error: error.message,
        });
    }
};

module.exports = { getTagWithContact };
