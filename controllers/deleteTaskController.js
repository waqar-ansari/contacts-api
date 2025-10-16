

const mongoose = require("mongoose");
const Contact = require("../models/contactModel");
const { logActivityToContact } = require("../utils/activityLogger"); // ✅ import activity logger

const deleteTask = async (req, res) => {
    const { contact_id, task_id } = req.body;

    // Validate contactId
    if (!mongoose.Types.ObjectId.isValid(contact_id)) {
        return res.status(400).json({
            status: "error",
            message: "Invalid contact ID",
        });
    }

    try {
        // 1️⃣ Find contact first to get the task description before deleting
        const contact = await Contact.findOne({
            _id: contact_id,
            createdBy: req.user._id,
            "tasks.task_id": task_id,
        });

        if (!contact) {
            return res.status(404).json({
                status: "error",
                message: "Task not found in this contact or unauthorized access",
            });
        }

        // 2️⃣ Extract the task description
        const task = contact.tasks.find(t => t.task_id === task_id);
        const taskDescription = task ? task.description || "No description" : "No description";

        // 3️⃣ Delete the task
        await Contact.updateOne(
            { _id: contact_id },
            { $pull: { tasks: { task_id } } }
        );

        // 4️⃣ Log the activity
        await logActivityToContact(contact_id, {
            action: "task_deleted",
            type: "task",
            title: "Task Deleted",
            description: `${taskDescription}`,
        });

        return res.status(200).json({
            status: "success",
            message: "Task Deleted",
            data: { task_id },
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

