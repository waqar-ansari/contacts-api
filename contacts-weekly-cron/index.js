require("dotenv").config();
console.log("Environment Variables Loaded");

const mongoose = require("mongoose");
const { sendWeeklyReport } = require("./services/weeklyReportService"); // ✅ new service
const User = require("./models/userModel");
const Contact = require("./models/contactModel");

let isConnected = false;

// ------------------- DB CONNECT -------------------
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
module.exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  console.log("🚀 Lambda function invoked on Monday");

  try {
    await connectToDatabase();

    // Trigger weekly report
    console.log("📅 Sending weekly connection reports...");
    const result = await sendWeeklyReport();

    console.log("✅ Weekly report execution completed:", result);
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: "Weekly report emails sent successfully",
        result,
      }),
    };
  } catch (error) {
    console.error("❌ Error executing weekly report:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: "Error executing weekly report",
        error: error.message,
      }),
    };
  }
};

// ------------------- LOCAL TESTING -------------------
if (require.main === module) {
  (async () => {
    console.log("🧪 Running in local testing mode...");
    await connectToDatabase();
    await sendWeeklyReport();
    process.exit(0);
  })();
}
