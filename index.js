require("dotenv").config();
console.log("Environment Variables Loaded:");
// super admin email password
// email : superadmin@example.com
// password : SuperSecure123
const express = require("express");
const app = express();
const cors = require("cors");

const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const multer = require("multer");

const storage = multer.memoryStorage();
// const upload = multer({ storage });
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max upload
});

const mongoose = require("mongoose");
// const v1Router = express.Router();
const serverless = require("serverless-http");

const swaggerUi = require("swagger-ui-express");
const swaggerDocs = require("./swaggerConfig");

console.log("Connecting to MongoDB...");

const userRoutes = require("./routes/userRoutes");
const editProfileRoutes = require("./routes/editProfileRoutes");
const contactRoutes = require("./routes/contactRoutes");
const getContactCountRoutes = require("./routes/getContactCountRoutes");
const incrementBusinessCardScan = require("./routes/businessCardCountRoutes");
const assignedContactTag = require("./routes/assignedContactTag");
const getContactRoutes = require("./routes/getContactRoutes");
const getContactEmailRoutes = require("./routes/getContactEmailRoutes");
const getProfileEventRoutes = require("./routes/getProfileEventRoutes");
const deleteContactRoutes = require("./routes/deleteContactRoutes");
const deleteTaskRoutes = require("./routes/deleteTaskRoutes");
const deleteMeetingRoutes = require("./routes/deleteMeetingRoutes");
const deleteTemplateRoutes = require("./routes/deleteTemplateRoutes");
const deleteUserRoutes = require("./routes/deleteUserRoutes");
const addTagRoutes = require("./routes/addTagRoutes");
const editTagRoutes = require("./routes/editTagRoutes");
const getTagRoutes = require("./routes/getTagRoutes");
const getTagWithContact = require("./routes/getTagWithContactRoutes");
const getUserRoutes = require("./routes/getUserRoutes");
const deleteTagRoutes = require("./routes/deleteTagRoutes");
const addToFavouriteRoutes = require("./routes/addToFavouriteRoutes");
const signRoutes = require("./routes/signRoutes");
const emailPasswordResetRoutes = require("./routes/emailPasswordResetRoutes");
const phoneNumberPasswordResetRoutes = require("./routes/phoneNumberPasswordResetRoutes");
const changePasswordRoutes = require("./routes/changePasswordRoutes");
const { checkForAuthentication } = require("./middlewares/authentication");
const checkRole = require("./middlewares/roleCheck");
const scanRoutes = require("./routes/scanRoutes");
const getScanDataRoutes = require("./routes/getScanDataRoutes");
const reminderRoutes = require("./routes/reminderRoutes");
const userInfoRoutes = require("./routes/userInfoRoutes");
const getUserCardRoutes = require("./routes/getUserCardRoutes");
const accountConnect = require("./routes/accountConnectRoutes");
const disconnectAccountRoutes = require("./routes/disconnectAccountRoutes");
const sendEmail = require("./routes/sendEmailRoutes");
const checkEmailPhoneDuplicate = require("./routes/checkEmailPhoneRoutes");
const saveBulkContactsRoutes = require("./routes/saveBulkContactsRoutes");
const getContactByIdRoutes = require("./routes/getContactByIdRoutes");
const getAllContactRoutes = require("./routes/getAllContactRoutes");
const getContactActivitiesRoutes = require("./routes/getActivityRoutes");
const fetchGoogleContacts = require("./routes/googleContactFatchRoutes");
const fetchLinkedInContacts = require("./routes/linkedinConnectionFetchRoutes");
const deleteAllContactRoutes = require("./routes/deleteAllContactRoutes");
const whatsappEmailActivityRoutes = require("./routes/whatsappEmailActivityRoutes");
const hubSpotContactFetchRoutes = require("./routes/hubSpotContactFetchRoutes");
const zohoContactFetchRoutes = require("./routes/zuhuContactFetchRoutes");
const myReferralsRoutes = require("./routes/getMyReferralsRoutes");
const helpSupportRoutes = require("./routes/helpSupportRoutes");
const planRoutes = require("./routes/planRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const apiKeyRoutes = require("./routes/apiKeyRoutes");
const { error } = require("console");
const PORT = process.env.PORT;
const sendBulkEmailRoutes = require("./routes/admin/sendBulkEmailRoutes");
//for admin routes
const adminLoginRoutes = require("./routes/admin/adminLoginRoute");
const adminUserRoutes = require("./routes/admin/adminUserRoutes");
const adminPlansRoutes = require("./routes/admin/adminPlansRoutes");
const addEditPlanRoutes = require("./routes/admin/addEditPlanRoutes");
const getAdminDetailsRoutes = require("./routes/admin/getAdminDetailsRoutes");
const adminHelpSupportRoutes = require("./routes/admin/adminHelpSupportRoutes");
const adminCouponsRoutes = require("./routes/admin/adminCouponsRoutes");
const configurationRoutes = require("./routes/admin/configurationRoutes");
// const testRoutes = require("./routes/testRoutes");
const webhookRoutes = require("./routes/webhookRoutes");
const quoteRoutes = require("./routes/admin/quoteRoutes");
const publicQuoteRoutes = require("./routes/public/publicQuoteRoutes");
const alertMessageEmailSubcriptionEndController = require("./routes/admin/alertMessageEmailSubcriptionEndRoutes");
const sendNotificationToAllUsers = require("./routes/admin/notificationRoutes");
const sendEmailToAllUsers = require("./routes/admin/adminEmailSentforUsersRoutes");
const weeklyReportRoutes = require("./routes/admin/weeklyReportRoutes");
const invoiceCustomizationRoutes = require("./routes/invoiceCustomizationRoutes");
const deleteUsersRoutes = require("./routes/admin/deleteUsersRoutes");

console.log("Setting up Express app...");

app.use(cors());

// Webhook routes must be defined before JSON parsing middleware
// because Stripe needs raw body for signature verification
// app.use("/webhooks", webhookRoutes);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use(express.static(path.resolve("./public")));
app.use("/user", userRoutes);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

console.log("Setting up routes...");

// Serve static files (for accessing uploaded images)
// app.use("/editProfile", checkForAuthentication(), editProfileRoutes);
app.use(
  "/editProfile",
  checkForAuthentication(),
  upload.single("profileImage"),
  editProfileRoutes
);
app.use("/deleteContact", deleteContactRoutes);
app.use("/deleteUser", checkForAuthentication(), deleteUserRoutes);
app.use("/deleteTask", checkForAuthentication(), deleteTaskRoutes);
app.use("/deleteMeeting", checkForAuthentication(), deleteMeetingRoutes);
app.use("/deleteTemplate", checkForAuthentication(), deleteTemplateRoutes);
app.use("/getUser", checkForAuthentication(), getUserRoutes);
app.use("/addTag", checkForAuthentication(), addTagRoutes);
app.use("/editTag", checkForAuthentication(), editTagRoutes);
app.use("/getTag", checkForAuthentication(), getTagRoutes);
app.use("/getTagWithContact", checkForAuthentication(), getTagWithContact);
app.use("/deleteTag", checkForAuthentication(), deleteTagRoutes);
app.use("/addToFavourite", checkForAuthentication(), addToFavouriteRoutes);
app.use("/getContact", checkForAuthentication(), getContactRoutes);
app.use("/getContactEmail", checkForAuthentication(), getContactEmailRoutes);
app.use("/getProfileEvent", checkForAuthentication(), getProfileEventRoutes);
// app.use("/googleConnect", checkForAuthentication(), googleConnect);
app.use("/my-referrals", checkForAuthentication(), myReferralsRoutes);
app.use(
  "/connect",
  (req, res, next) => {
    const skipAuthPaths = ["/google-callback", "/microsoft-callback"];
    if (skipAuthPaths.includes(req.path)) {
      return next(); // No token required for callback
    }
    return checkForAuthentication()(req, res, next);
  },
  accountConnect
);

app.use(
  "/addEditContact",
  checkForAuthentication(),
  upload.single("contactImage"),
  contactRoutes
);
app.use("/getContactCount", checkForAuthentication(), getContactCountRoutes);
app.use(
  "/businessCardCount",
  checkForAuthentication(),
  incrementBusinessCardScan
);
app.use("/assign-unassign-tag", checkForAuthentication(), assignedContactTag);
app.use("/disconnect", checkForAuthentication(), disconnectAccountRoutes);
app.use("/sign", checkForAuthentication(), signRoutes);
app.use("/email", emailPasswordResetRoutes);
app.use("/phoneNumber", phoneNumberPasswordResetRoutes);
app.use("/changePassword", checkForAuthentication(), changePasswordRoutes);
app.use("/scan", scanRoutes);
app.use("/scan/get_data", checkForAuthentication(), getScanDataRoutes);
app.use("/sendEmail", checkForAuthentication(), sendEmail);
app.use("/reminders", checkForAuthentication(), reminderRoutes);
app.use("/user-info", checkForAuthentication(), userInfoRoutes);
app.use("/shareProfile", getUserCardRoutes);
app.use(
  "/check-duplicate-user",
  checkForAuthentication(),
  checkEmailPhoneDuplicate
);
app.use(
  "/save-bulk-contacts",
  checkForAuthentication(),
  saveBulkContactsRoutes
);
app.use("/getContactById", checkForAuthentication(), getContactByIdRoutes);
app.use("/getAllContact", checkForAuthentication(), getAllContactRoutes);
app.use(
  "/getContactActivities",
  checkForAuthentication(),
  getContactActivitiesRoutes
);
app.use("/deleteAllContacts", checkForAuthentication(), deleteAllContactRoutes);
// app.use("/fetch-google-contacts", checkForAuthentication(), fetchGoogleContacts);
app.use(
  "/whatsapp-email-call-activity",
  checkForAuthentication(),
  whatsappEmailActivityRoutes
);
app.use(
  "/help-support",
  checkForAuthentication(),
  upload.single("helpAndSupportAttachments"),
  helpSupportRoutes
);
app.use("/plans", checkForAuthentication(), planRoutes); // Public route for getting plans
app.use("/user/payment", checkForAuthentication(), paymentRoutes);
app.use("/api-key", checkForAuthentication(), apiKeyRoutes);

app.use("/send-bulk-email", checkForAuthentication(),
  checkRole(["superadmin"]),
  sendBulkEmailRoutes);
app.use("/quote", publicQuoteRoutes); // Public route for getting quotes
app.use(
  "/fetch-google-contacts",
  (req, res, next) => {
    const skipAuthPaths = ["/google/callback"];
    if (skipAuthPaths.includes(req.path)) {
      return next(); // No token required for callback
    }
    return checkForAuthentication()(req, res, next);
  },
  fetchGoogleContacts
);

app.use(
  "/fetch-linkedin-contacts",
  (req, res, next) => {
    const skipAuthPaths = ["/linkedin/callback"];
    if (skipAuthPaths.includes(req.path)) {
      return next(); // No token required for callback
    }
    return checkForAuthentication()(req, res, next);
  },
  fetchLinkedInContacts
);

app.use(
  "/fetch-hubspot-contacts",
  (req, res, next) => {
    const skipAuthPaths = ["/hubspot/callback"];
    if (skipAuthPaths.includes(req.path)) {
      return next(); // No token required for callback
    }
    return checkForAuthentication()(req, res, next);
  },
  hubSpotContactFetchRoutes
);

app.use(
  "/fetch-zoho-contacts",
  (req, res, next) => {
    const skipAuthPaths = ["/zoho/callback"];
    if (skipAuthPaths.includes(req.path)) {
      return next(); // No token required for callback
    }
    return checkForAuthentication()(req, res, next);
  },
  zohoContactFetchRoutes
);

//for admin routes
app.use(
  "/admin/users",
  checkForAuthentication(),
  checkRole(["superadmin"]),
  adminUserRoutes
);
app.use("/admin/delete-users",
  checkForAuthentication(),
  checkRole(["superadmin"]),
  deleteUsersRoutes
);
app.use(
  "/admin/plans",
  checkForAuthentication(),
  checkRole(["superadmin"]),
  adminPlansRoutes
);
app.use(
  "/admin/configuration",
  checkForAuthentication(),
  checkRole(["superadmin"]),
  configurationRoutes
);

app.use("/admin/login", adminLoginRoutes);
app.use(
  "/admin/addEditPlan",
  checkForAuthentication(),
  checkRole(["superadmin"]),
  addEditPlanRoutes
);
app.use(
  "/admin/help-support",
  checkForAuthentication(),
  checkRole(["superadmin"]),
  adminHelpSupportRoutes
);
app.use(
  "/admin/coupons",
  checkForAuthentication(),
  checkRole(["superadmin"]),
  adminCouponsRoutes
);

app.use(
  "/admin/quote",
  checkForAuthentication(),
  checkRole(["superadmin"]),
  quoteRoutes
);

app.use(
  "/admin/subscription-alerts",
  checkForAuthentication(),
  checkRole(["superadmin"]),
  alertMessageEmailSubcriptionEndController
);

app.use(
  "/admin/notification",
  checkForAuthentication(),
  checkRole(["superadmin"]),
  sendNotificationToAllUsers
);

app.use(
  "/admin/email",
  checkForAuthentication(),
  checkRole(["superadmin"]),
  sendEmailToAllUsers
);

// app.use(
//   "/admin/invoice-customization",
//   checkForAuthentication(),
//   checkRole(["superadmin"]),
//   invoiceCustomizationRoutes
// );

app.use("/admin/user-weekly-report", weeklyReportRoutes);

// app.use("/admin/user-weekly-report/send-weekly-report",
//   checkForAuthentication(),
//   checkRole(["superadmin"]),
//   weeklyReportRoutes);

///havent updates these test routes with the new useTestMode flag
// app.use("/test", testRoutes);
// app.use(
//   "/admin",
//   checkForAuthentication(),
//   checkRole(["superadmin"]),
//   getAdminDetailsRoutes
// );

app.use("/check", (req, res) => {
  res.json({ message: "API checkPage" });
});
app.use("/", (req, res) => {
  console.log("hello from homepage");

  res.json({ message: "API Homepage" });
});

console.log("Setting up error handling...");

// ------------------- DB CONNECT -------------------
let cachedConnection = null;

const connectToDatabase = async () => {
  // Check if connection exists AND is actually working
  if (cachedConnection && mongoose.connection.readyState === 1) {
    console.log("♻️ Using cached MongoDB connection");
    return cachedConnection;
  }

  try {
    // Close any stale connections
    if (mongoose.connection.readyState !== 0) {
      console.log("🔄 Closing stale connection...");
      await mongoose.connection.close();
    }

    console.log("MongoDB URL log:", process.env.MONGO_URL);

    // Optimized settings for AWS Lambda
    const connection = await mongoose.connect(process.env.MONGO_URL, {
      maxPoolSize: 10, // Lower pool size for Lambda (not 200!)
      minPoolSize: 1, // Keep it minimal
      serverSelectionTimeoutMS: 10000, // Increase timeout
      socketTimeoutMS: 45000, // Socket timeout
      connectTimeoutMS: 10000, // Connection timeout
      retryWrites: true,
      retryReads: true,
      maxIdleTimeMS: 10000, // Close idle connections faster
      // Disable buffering - fail fast instead of queuing
      bufferCommands: false,
    });

    cachedConnection = connection;
    console.log("✅ MongoDB connected successfully");
    return connection;
  } catch (err) {
    console.error("❌ Database connection failed:", err);
    cachedConnection = null;
    throw err;
  }
};

// ------------------- CRITICAL: Context settings -------------------
// Tell Lambda not to wait for empty event loop
if (process.env.NODE_ENV === "serverless") {
  app.use((req, res, next) => {
    // This is crucial for Lambda
    if (typeof context !== "undefined") {
      context.callbackWaitsForEmptyEventLoop = false;
    }
    next();
  });
}

// ------------------- SOCKET HANDLER -------------------
const http = require("http");

// ------------------- START APP -------------------
(async () => {
  try {
    await connectToDatabase();

    // ✅ Local/dev mode: Start HTTP + Socket.IO
    if (process.env.NODE_ENV !== "serverless") {
      const PORT = process.env.PORT || 3000;
      const server = http.createServer(app);

      server.listen(PORT, () =>
        console.log(`🚀 Server running on http://localhost:${PORT}`)
      );
    }
  } catch (err) {
    console.error("Startup Error:", err);
  }
})();

// ------------------- SERVERLESS EXPORT -------------------
module.exports.handler = serverless(async (event, context) => {
  // CRITICAL: Prevent Lambda from waiting for connections to close
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connectToDatabase();
    return app(event, context);
  } catch (error) {
    console.error("Lambda handler error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
});

// (async () => {
//   console.log("Connecting to MongoDB...");

//   try {
//     console.log("MongoDB URL log:", process.env.MONGO_URL);

//     await mongoose.connect(process.env.MONGO_URL);
//     console.log("MongoDB connected successfully");
//     // app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
//     const http = require("http");
//     const { Server } = require("socket.io");
//     const socketHandler = require("./socket/socketHandler"); // create this file

//     const server = http.createServer(app);

//     const io = new Server(server, {
//       cors: {
//         origin: "*", // or set to your frontend domain
//         methods: ["GET", "POST"],
//       },
//     });

//     // pass io to socket handler
//     socketHandler(io);

//     server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
//   } catch (err) {
//     console.error("Database connection failed:", err);
//   }
// })();
// module.exports.handler = serverless(app);

// // let isConnected = false;

// // const connectToDatabase = async () => {
// //   if (isConnected) {
// //     return;
// //   }
// //   try {
// //     console.log("Console 7 MongoDB URL log:", process.env.MONGO_URL);
// //     await mongoose.connect(process.env.MONGO_URL, {
// //       useNewUrlParser: true,
// //       useUnifiedTopology: true,

// //     });
// //     isConnected = true;
// //     console.log("Console 8 MongoDB connected successfully");
// //   } catch (err) {
// //     console.error("Console 9 Database connection failed:", err);
// //     throw err;
// //   }
// // };

// // console.log("Console 10 last log before export");

// // module.exports.handler = serverless(async (event, context) => {
// //   await connectToDatabase();
// //   return app(event, context);
// // });
