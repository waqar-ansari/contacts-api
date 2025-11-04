const User = require("../../models/userModel");
const Notification = require("../../models/notificationModel");
const { sendPushNotification } = require("../../utils/oneSignal"); // your existing util

// Send Notification to ALL users
exports.sendNotificationToAllUsers = async (req, res) => {
  try {
    const { heading, message, url, data = {} } = req.body;
    const adminId = req.user?._id || null; // assuming admin is authenticated

    if (!heading || !message) {
      return res.status(400).json({
        success: false,
        message: "Heading and message are required.",
      });
    }

    // Fetch all users who have OneSignal identifiers
    const users = await User.find({
      $or: [
        { oneSignalExternalUserIds: { $exists: true, $ne: [] } },
        { oneSignalPlayerIds: { $exists: true, $ne: [] } },
      ],
    });

    if (!users.length) {
      return res.status(404).json({
        success: false,
        message: "No users with OneSignal IDs found.",
      });
    }

    // Collect all external IDs
    const externalIds = users.flatMap((u) => u.oneSignalExternalUserIds || []);
    const playerIds = users.flatMap((u) => u.oneSignalPlayerIds || []);

    // Save record in DB before sending
    const notification = await Notification.create({
      heading,
      message,
      data,
      url,
      sentBy: adminId,
      sentToAll: true,
      sentToUsers: users.map((u) => u._id),
      status: "pending",
    });

    try {
      // Prefer external_user_ids if available
      await sendPushNotification({
        heading,
        content: message,
        include_external_user_ids: externalIds.length ? externalIds : [],
        include_player_ids: externalIds.length ? [] : playerIds,
        data,
        url,
      });

      notification.status = "sent";
      await notification.save();

      res.status(200).json({
        success: true,
        message: "Notification sent to all users successfully.",
        notification,
      });
    } catch (err) {
      notification.status = "failed";
      notification.error = err.message;
      await notification.save();

      res.status(500).json({
        success: false,
        message: "Failed to send OneSignal notification.",
        error: err.message,
      });
    }
  } catch (err) {
    console.error("Error sending admin notification:", err);
    res.status(500).json({
      success: false,
      message: "Server error while sending notification.",
      error: err.message,
    });
  }
};
