const express = require("express");
const router = express.Router();
const { getContactActivities } = require("../controllers/getActivityController");

// GET /api/contacts/activity?contact_id=123
router.get("/", getContactActivities);

module.exports = router;
