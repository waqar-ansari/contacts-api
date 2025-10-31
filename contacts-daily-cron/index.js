require("dotenv").config();
console.log("Environment Variables Loaded");

const mongoose = require("mongoose");

// Import subscription alert service
const {
  sendSubscriptionExpiryAlerts,
} = require("./services/subscriptionAlertService");

// Configuration: Days before expiry to send alert (configurable via environment variable)
const DAYS_BEFORE_EXPIRY = parseInt(process.env.DAYS_BEFORE_EXPIRY) || 7;

// ------------------- DB CONNECT -------------------
let isConnected = false;

const connectToDatabase = async () => {
  if (isConnected) {
    console.log("✅ Using existing MongoDB connection");
    return;
  }

  try {
    console.log("🔄 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URL, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    console.log("✅ MongoDB connected successfully");
  } catch (err) {
    console.error("❌ Database connection failed:", err);
    throw err;
  }
};

// ------------------- LAMBDA HANDLER -------------------
/**
 * AWS Lambda handler function for EventBridge cron trigger
 * @param {Object} event - EventBridge event object
 * @param {Object} context - Lambda context object
 * @returns {Object} Response object
 */
module.exports.handler = async (event, context) => {
  // AWS Lambda context optimization
  context.callbackWaitsForEmptyEventLoop = false;

  console.log("🚀 Lambda function invoked");
  console.log("Event:", JSON.stringify(event, null, 2));

  try {
    // Connect to database
    await connectToDatabase();

    // Run the subscription expiry alerts
    console.log(
      `� Running subscription expiry alerts for ${DAYS_BEFORE_EXPIRY} days before expiry...`
    );
    const result = await sendSubscriptionExpiryAlerts(DAYS_BEFORE_EXPIRY);

    console.log("✅ Subscription alerts completed successfully");
    console.log("📊 Result:", JSON.stringify(result, null, 2));

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: "Subscription expiry alerts executed successfully",
        ...result,
      }),
    };
  } catch (error) {
    console.error("❌ Lambda execution error:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: "Error executing subscription alerts",
        error: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      }),
    };
  }
};

// ------------------- LOCAL TESTING -------------------
// Run directly if not in Lambda environment (for local testing)
if (require.main === module) {
  (async () => {
    console.log("🧪 Running in local testing mode...");

    try {
      await connectToDatabase();

      const result = await sendSubscriptionExpiryAlerts(DAYS_BEFORE_EXPIRY);
      console.log("📊 Test Result:", JSON.stringify(result, null, 2));

      process.exit(0);
    } catch (err) {
      console.error("❌ Test Error:", err);
      process.exit(1);
    }
  })();
}
