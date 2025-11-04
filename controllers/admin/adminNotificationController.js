const User = require("../../models/userModel");
const Notification = require("../../models/notificationModel");
const { sendPushNotification } = require("../../utils/oneSignal");

// ✅ Send Notification to ALL users (using external_user_ids pattern)
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

    // ✅ Fetch all users
    const users = await User.find({}, "_id");
    console.log(`Found ${users.length} users in database.`);

    if (!users.length) {
      return res.status(404).json({
        success: false,
        message: "No users found in the database.",
      });
    }

    // ✅ Generate OneSignal external IDs (based on userId)
    const externalIds = users.map((u) => `user_${u._id}`);

    // ✅ Save notification record first (status: pending)
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
      // ✅ Send push notification to all users using generated external IDs
      await sendPushNotification({
        heading,
        content: message,
        include_external_user_ids: externalIds,
        data,
        url,
      });

      // ✅ Update notification status to sent
      notification.status = "sent";
      await notification.save();

      res.status(200).json({
        success: "success",
        message: `Notification sent to ${externalIds.length} users successfully.`,
        data: notification,
      });
    } catch (err) {
      // ✅ Update DB in case of failure
      notification.status = "failed";
      notification.error = err.message;
      await notification.save();

      console.error("❌ OneSignal error:", err.message);
      res.status(500).json({
        status: "error",
        message: "Failed to send OneSignal notification.",
        error: err.message,
      });
    }
  } catch (err) {
    console.error("❌ Error sending admin notification:", err);
    res.status(500).json({
      status: "error",
      message: "Server error while sending notification.",
      error: err.message,
    });
  }
};

exports.getAllNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find()
      .sort({ createdAt: -1 })
      .populate("sentBy", "firstname lastname email")
      .populate("sentToUsers", "firstname lastname email");
    res.status(200).json({
      success: "success",
      message: "Notifications fetched.",
      data: notifications,
    });
  }
  catch (err) {
    console.error("❌ Error fetching notifications:", err);
    res.status(500).json({
      status: "error",
      message: "Server error while fetching notifications.",
      error: err.message,
    });
  }
};