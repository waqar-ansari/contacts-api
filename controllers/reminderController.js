const User = require('../models/userModel');
const moment = require("moment");

// GET all reminders for a user
exports.getReminders = async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId);

        if (!user) return res.status(404).json({ status: "error", message: 'User not found' });

        // Format each reminder date for display
        const formattedReminders = user.reminders.map((reminder) => ({
            id: reminder._id,
            title: reminder.title,
            description: reminder.description,
            date: moment(reminder.date).format("DD/MM/YYYY hh:mm A")
        }));

        res.json({ status: "success", message: "Reminders fetched successfully", data: formattedReminders });
    } catch (error) {
        res.status(500).json({ status: false, message: error.message });
    }
};

// ADD or EDIT reminder
exports.addEditReminder = async (req, res) => {
    try {
        const userId = req.user._id;
        const { id, title, description, date, time } = req.body;

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ status: "error", message: 'User not found' });

        // Combine date and time into a full datetime string
        const combinedDateTime = `${date} ${time}`; // "18/04/2025 10:10 AM"
        const parsedDate = moment(combinedDateTime, "DD/MM/YYYY hh:mm A", true);

        if (!parsedDate.isValid()) {
            return res.status(400).json({ message: "Invalid date or time format. Use DD/MM/YYYY and hh:mm A" });
        }

        let reminder;

        if (id) {
            // Edit existing reminder
            reminder = user.reminders.id(id);
            if (!reminder) return res.status(404).json({ status: "error", message: 'Reminder not found' });

            reminder.title = title;
            reminder.description = description;
            reminder.date = parsedDate.toDate();
        } else {
            // Add new reminder
            const reminderData = {
                title,
                description,
                date: parsedDate.toDate(),
            };
            user.reminders.push(reminderData);
            reminder = user.reminders[user.reminders.length - 1];
        }

        await user.save();

        // Format date in the desired format for response
        const formattedReminder = {
            id: reminder._id,
            title: reminder.title,
            description: reminder.description,
            date: moment(reminder.date).format("DD/MM/YYYY hh:mm A"),
            createdAt: reminder.createdAt,
            updatedAt: reminder.updatedAt,
        };

        res.json({ status: "success", message: "Reminder saved successfully", data: formattedReminder });
    } catch (error) {
        console.log(error);
        res.status(500).json({ status: "error", message: "Internal server error" });
    }
};


// DELETE reminder
exports.deleteReminder = async (req, res) => {
    try {
        const reminderId = req.body.reminderId;
        const userId = req.user._id;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ status: "error", message: 'User not found' });
        }

        // Find the reminder
        const reminder = user.reminders.id(reminderId);
        if (!reminder) {
            return res.status(404).json({ status: "error", message: 'Reminder not found' });
        }

        // Remove using .pull()
        user.reminders.pull(reminderId);

        await user.save();

        res.json({ status: "success", message: 'Reminder deleted successfully' });
    } catch (error) {
        console.log(error);
        res.status(500).json({ status: "error", message: "Internal server error" });
    }
};

