const express = require("express");
const router = express.Router();
const { sendWeeklyReport } = require("../../controllers/admin/weeklyReportController");

// ✅ Admin-triggered API: Run every Monday (via cron or manually)
router.get("/", sendWeeklyReport);

module.exports = router;
