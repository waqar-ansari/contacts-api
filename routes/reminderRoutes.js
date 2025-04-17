const express = require('express');
const router = express.Router();
const {
  getReminders,
  addEditReminder,
  deleteReminder,
} = require('../controllers/reminderController');

// GET /reminders/:userId
router.get('/:userId', getReminders);

// POST /reminders/:userId
router.post('/:userId', addEditReminder);

// DELETE /reminders/:userId/:reminderId
router.delete('/:userId/:reminderId', deleteReminder);

module.exports = router;
