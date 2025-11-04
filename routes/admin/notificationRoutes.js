const express = require("express");
const router = express.Router();
const { sendNotificationToAllUsers } = require("../../controllers/admin/adminNotificationController");
// const { isAdmin, isAuthenticated } = require("../../middlewares/authMiddleware");

// POST /api/admin/send-notification
router.post(
    "/",
    sendNotificationToAllUsers
);

module.exports = router;
