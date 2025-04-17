const User = require('../models/userModel');

// GET all reminders for a user
exports.getReminders = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);

    if (!user) return res.status(404).json({ status: false, message: 'User not found' });

    res.json({ status: true, reminders: user.reminders });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};

// ADD or EDIT reminder
exports.addEditReminder = async (req, res) => {
  try {
    const { userId } = req.params;
    const { id, title, description, date } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ status: false, message: 'User not found' });

    let reminder;

    if (id) {
      // Edit
      reminder = user.reminders.id(id);
      if (!reminder) return res.status(404).json({ status: false, message: 'Reminder not found' });

      reminder.title = title;
      reminder.description = description;
      reminder.date = date;
    } else {
      // Add
      reminder = {
        title,
        description,
        date,
      };
      user.reminders.push(reminder);
    }

    await user.save();
    res.json({ status: true, reminder });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};

// DELETE reminder
exports.deleteReminder = async (req, res) => {
  try {
    const { userId, reminderId } = req.params;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ status: false, message: 'User not found' });

    const reminder = user.reminders.id(reminderId);
    if (!reminder) return res.status(404).json({ status: false, message: 'Reminder not found' });

    reminder.remove();
    await user.save();

    res.json({ status: true, message: 'Reminder deleted' });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};
