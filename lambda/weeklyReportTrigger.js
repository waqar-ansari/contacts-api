require("dotenv").config();
const axios = require("axios");

// Use your deployed API Gateway URL, not localhost

// const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || "http://localhost:3003";

const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || "https://16za49tm71.execute-api.eu-north-1.amazonaws.com";


module.exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  console.log("🚀 Weekly Report Lambda triggered via EventBridge");
  console.log("Event:", JSON.stringify(event, null, 2));

  try {
    // Your public API (no auth needed)
    const apiUrl = `${BACKEND_BASE_URL}/admin/user-weekly-report`;

    console.log(`📡 Sending request to: ${apiUrl}`);

    const response = await axios.get(apiUrl);

    console.log("✅ Weekly report job executed successfully");
    console.log("Response:", response.data);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: "Weekly report executed successfully",
      }),
    };
  } catch (err) {
    console.error("❌ Weekly report job failed:", err.message);

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: err.message,
      }),
    };
  }
};
