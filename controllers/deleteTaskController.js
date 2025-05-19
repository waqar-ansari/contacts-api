const mongoose = require("mongoose");
const Contact = require("../models/contactModel");

const deleteTask = async (req, res) => {
    const { contactId, taskId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(contactId)) {
        return res.status(400).json({
            status: "error",
            message: "Invalid contact ID",
        });
    }

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
        return res.status(400).json({
            status: "error",
            message: "Invalid task ID",
        });
    }

    try {
        const updatedContact = await Contact.findOneAndUpdate(
            {
                _id: contactId,
                createdBy: req.user._id,
                "tasks.taskId": taskId,
            },
            {
                $pull: { tasks: { taskId: taskId } },
            },
            { new: true }
        );

        if (!updatedContact) {
            return res.status(404).json({
                status: "error",
                message: "Task not found in this contact or unauthorized access",
            });
        }

        return res.status(200).json({
            status: "success",
            message: "Task deleted successfully",
        });
    } catch (error) {
        console.error("Delete Task Error:", error);
        return res.status(500).json({
            status: "error",
            message: "An error occurred while deleting the task",
        });
    }
};

module.exports = {
    deleteTask,
};
