const mongoose = require("mongoose");
const Contact = require("../models/contactModel");

const deleteTask = async (req, res) => {
    const { contact_id, task_id } = req.body;

    // Validate only contactId
    if (!mongoose.Types.ObjectId.isValid(contact_id)) {
        return res.status(400).json({
            status: "error",
            message: "Invalid contact ID",
        });
    }


    try {
        const updatedContact = await Contact.findOneAndUpdate(
            {
                _id: contact_id,
                createdBy: req.user._id,
                "tasks.task_id": task_id,
            },
            {
                $pull: { tasks: { task_id: task_id } },
            },
            { new: true }
        );

        if (!updatedContact) {
            return res.status(404).json({
                status: "error",
                message: "Note not found in this contact or unauthorized access",
            });
        }

        return res.status(200).json({
            status: "success",
            message: "Note deleted successfully",
            data: { task_id: task_id },
        });
    } catch (error) {
        console.error("Delete Task Error:", error);
        return res.status(500).json({
            status: "error",
            message: "An error occurred while deleting the Note",
        });
    }
};

module.exports = {
    deleteTask,
};
