const express = require("express");
const router = express.Router();
const { sendSubscriptionExpiryAlerts } = require("../../controllers/admin/alertMessageEmailSubcriptionEndController");

// POST /api/admin/send-subscription-alerts
router.post("/", sendSubscriptionExpiryAlerts);

module.exports = router;
