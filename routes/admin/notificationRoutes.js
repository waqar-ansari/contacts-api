const express = require("express");
const router = express.Router();
const { sendNotificationToAllUsers, getAllNotifications } = require("../../controllers/admin/adminNotificationController");
// const { isAdmin, isAuthenticated } = require("../../middlewares/authMiddleware");

// POST /api/admin/send-notification
router.post(
    "/",
    sendNotificationToAllUsers
);

router.get("/get", getAllNotifications); // GET /api/admin/notifications

module.exports = router;
