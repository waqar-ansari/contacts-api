const axios = require("axios");

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

async function sendPushNotification({
  heading = "Notification",
  content = "",
  include_player_ids = [], // optional array of OneSignal player IDs (legacy support)
  include_external_user_ids = [], // recommended - array of external_user_ids (strings)
  data = {}, // optional additional data payload
  url = null, // optional URL to redirect when notification is clicked
}) {
  if (
    (!include_player_ids || include_player_ids.length === 0) &&
    (!include_external_user_ids || include_external_user_ids.length === 0)
  ) {
    throw new Error(
      "No OneSignal recipients provided (player ids or external_user_ids)"
    );
  }

  const body = {
    app_id: ONESIGNAL_APP_ID,
    headings: { en: heading },
    contents: { en: content },
    data,
  };

  // Add URL if provided
  if (url) {
    body.url = url;
  }

  // Prioritize external_user_ids as they are more reliable
  if (include_external_user_ids && include_external_user_ids.length) {
    body.include_external_user_ids = include_external_user_ids;
  } else if (include_player_ids && include_player_ids.length) {
    body.include_player_ids = include_player_ids;
  }

  const res = await axios.post(
    "https://onesignal.com/api/v1/notifications",
    body,
    {
      headers: {
        Authorization: `Basic ${ONESIGNAL_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  return res.data;
}

// Helper function to send notification by user ID
async function sendPushNotificationToUser(
  userId,
  { heading, content, data = {}, url = null }
) {
  const externalId = `user_${userId}`;

  return await sendPushNotification({
    heading,
    content,
    include_external_user_ids: [externalId],
    data,
    url,
  });
}

module.exports = { sendPushNotification, sendPushNotificationToUser };
