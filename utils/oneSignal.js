const axios = require("axios");

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

async function sendPushNotification({
  heading = "Notification",
  content = "",
  include_player_ids = [],            // optional array of OneSignal player IDs
  include_external_user_ids = [],     // optional array of external_user_ids (strings)
  data = {},                          // optional additional data payload
}) {
  if ((!include_player_ids || include_player_ids.length === 0) &&
      (!include_external_user_ids || include_external_user_ids.length === 0)) {
    throw new Error("No OneSignal recipients provided (player ids or external_user_ids)");
  }

  const body = {
    app_id: ONESIGNAL_APP_ID,
    headings: { en: heading },
    contents: { en: content },
    data,
  };

  if (include_player_ids && include_player_ids.length) {
    body.include_player_ids = include_player_ids;
  }

  if (include_external_user_ids && include_external_user_ids.length) {
    body.include_external_user_ids = include_external_user_ids;
  }

  const res = await axios.post("https://onesignal.com/api/v1/notifications", body, {
    headers: {
      "Authorization": `Basic ${ONESIGNAL_API_KEY}`,
      "Content-Type": "application/json",
    },
  });

  return res.data;
}

module.exports = { sendPushNotification };
