require("dotenv").config();
console.log("Environment Variables Loaded:");

const express = require("express");
const app = express();
const cors = require("cors");

const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const multer = require("multer");

const storage = multer.memoryStorage();
const upload = multer({ storage });

const mongoose = require("mongoose");
// const v1Router = express.Router();
const serverless = require("serverless-http");

const swaggerUi = require("swagger-ui-express");
const swaggerDocs = require("./swaggerConfig");


console.log("Connecting to MongoDB...");

const userRoutes = require("./routes/userRoutes");
const editProfileRoutes = require("./routes/editProfileRoutes");
const contactRoutes = require("./routes/contactRoutes");
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
const { error } = require("console");
const PORT = process.env.PORT;


//for admin routes
const adminUserRoutes = require("./routes/admin/userRoutes");
const adminAccountConnectRoutes = require("./routes/admin/accountConnectRoutes");
const addAdminRoutes = require("./routes/admin/addAdminRoutes");
const getAdminRoutes = require("./routes/admin/getUserRoutes");
const getAllUserAndAdminRoutes = require("./routes/admin/getAllUserAndAdminRoutes");

console.log("Setting up Express app...");


app.use(cors());

app.use(express.json());
app.use(express.static(path.resolve("./public")));
app.use("/user", userRoutes);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));

console.log("Setting up routes...");


// Serve static files (for accessing uploaded images)
// app.use("/editProfile", checkForAuthentication(), editProfileRoutes);
app.use("/editProfile", checkForAuthentication(), checkRole(['user']), upload.single("profileImage"),
  editProfileRoutes);
app.use("/deleteContact", deleteContactRoutes);
app.use("/deleteUser", checkForAuthentication(), checkRole(['user']), deleteUserRoutes);
app.use("/deleteTask", checkForAuthentication(), checkRole(['user']), deleteTaskRoutes);
app.use("/deleteMeeting", checkForAuthentication(), checkRole(['user']), deleteMeetingRoutes);
app.use("/deleteTemplate", checkForAuthentication(), checkRole(['user']), deleteTemplateRoutes);
app.use("/getUser", checkForAuthentication(), checkRole(['user']), getUserRoutes);
app.use("/addTag", checkForAuthentication(), checkRole(['user']), addTagRoutes);
app.use("/editTag", checkForAuthentication(), checkRole(['user']), editTagRoutes);
app.use("/getTag", checkForAuthentication(), checkRole(['user']), getTagRoutes);
app.use("/deleteTag", checkForAuthentication(), checkRole(['user']), deleteTagRoutes);
app.use("/addToFavourite", checkForAuthentication(), checkRole(['user']), addToFavouriteRoutes);
app.use("/getContact", checkForAuthentication(), checkRole(['user']), getContactRoutes);
app.use("/getContactEmail", checkForAuthentication(), checkRole(['user']), getContactEmailRoutes);
app.use("/getProfileEvent", checkForAuthentication(), checkRole(['user']), getProfileEventRoutes);
// app.use("/googleConnect", checkForAuthentication(), googleConnect);
app.use("/my-referrals", checkForAuthentication(), checkRole(['user']), myReferralsRoutes);
app.use("/connect", (req, res, next) => {
  const skipAuthPaths = ["/google-callback", "/microsoft-callback"];
  if (skipAuthPaths.includes(req.path)) {
    return next(); // No token required for callback
  }
  return checkForAuthentication()(req, res, next);
}, checkRole(['user']), accountConnect);

app.use(
  "/addEditContact",
  checkForAuthentication(),
  checkRole(['user']),
  upload.single("contactImage"),
  contactRoutes
);
app.use("/assignedContactTag", checkForAuthentication(), checkRole(['user']), assignedContactTag);
app.use("/disconnect", checkForAuthentication(), checkRole(['user']), disconnectAccountRoutes);
app.use("/sign", checkForAuthentication(), checkRole(['user']), signRoutes);
app.use("/email", emailPasswordResetRoutes);
app.use("/phoneNumber", phoneNumberPasswordResetRoutes);
app.use("/changePassword", checkForAuthentication(), checkRole(['user']), changePasswordRoutes);
app.use("/scan", scanRoutes);
app.use("/scan/get_data", checkForAuthentication(), checkRole(['user']), getScanDataRoutes);
app.use("/sendEmail", checkForAuthentication(), checkRole(['user']), sendEmail);
app.use("/reminders", checkForAuthentication(), checkRole(['user']), reminderRoutes);
app.use("/user-info", checkForAuthentication(), checkRole(['user']), userInfoRoutes);
app.use("/shareProfile", getUserCardRoutes);
app.use("/check-duplicate-user", checkForAuthentication(), checkRole(['user']), checkEmailPhoneDuplicate);
app.use("/save-bulk-contacts", checkForAuthentication(), checkRole(['user']), saveBulkContactsRoutes);
app.use("/getContactById", checkForAuthentication(), checkRole(['user']), getContactByIdRoutes);
app.use("/getAllContact", checkForAuthentication(), checkRole(['user']), getAllContactRoutes);
app.use("/getContactActivities", checkForAuthentication(), checkRole(['user']), getContactActivitiesRoutes);
app.use("/deleteAllContacts", checkForAuthentication(), checkRole(['user']), deleteAllContactRoutes);
// app.use("/fetch-google-contacts", checkForAuthentication(), fetchGoogleContacts);
app.use("/whatsapp-email-activity", checkForAuthentication(), checkRole(['user']), whatsappEmailActivityRoutes);
app.use("/fetch-google-contacts", (req, res, next) => {
  const skipAuthPaths = ["/google/callback"];
  if (skipAuthPaths.includes(req.path)) {
    return next(); // No token required for callback
  }
  return checkForAuthentication()(req, res, next);
}, checkRole(['user']), fetchGoogleContacts);

app.use("/fetch-linkedin-contacts", (req, res, next) => {
  const skipAuthPaths = ["/linkedin/callback"];
  if (skipAuthPaths.includes(req.path)) {
    return next(); // No token required for callback
  }
  return checkForAuthentication()(req, res, next);
}, checkRole(['user']), fetchLinkedInContacts);

app.use("/fetch-hubspot-contacts", (req, res, next) => {
  const skipAuthPaths = ["/hubspot/callback"];
  if (skipAuthPaths.includes(req.path)) {
    return next(); // No token required for callback
  }
  return checkForAuthentication()(req, res, next);
}, checkRole(['user']), hubSpotContactFetchRoutes);

app.use("/fetch-zoho-contacts", (req, res, next) => {
  const skipAuthPaths = ['/zoho/callback'];
  if (skipAuthPaths.includes(req.path)) {
    return next(); // No token required for callback
  }
  return checkForAuthentication()(req, res, next);
}, checkRole(['user']), zohoContactFetchRoutes);

//for admin routes
app.use("/admin/user", adminUserRoutes);
app.use("/admin/account-connect", checkForAuthentication(), checkRole(['admin', 'superadmin']), adminAccountConnectRoutes);
app.use("/admin/add-admin", checkForAuthentication(), checkRole(['superadmin']), addAdminRoutes);
app.use("/admin/get-user", checkForAuthentication(), checkRole(['superadmin', 'admin']), getAdminRoutes);
app.use("/admin/get-all-users-admins", checkForAuthentication(), checkRole(['superadmin']), getAllUserAndAdminRoutes);


app.use("/check", (req, res) => {
  res.json({ message: "API checkPage" });
});
app.use("/", (req, res) => {
  console.log("hello from homepage");

  res.json({ message: "API Homepage" });
});

console.log("Setting up error handling...");

(async () => {
  console.log("Connecting to MongoDB...");

  try {

    console.log("MongoDB URL log:", process.env.MONGO_URL);


    await mongoose.connect(process.env.MONGO_URL);
    console.log("MongoDB connected successfully");
    app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
  } catch (err) {
    console.error("Database connection failed:", err);
  }
})();
module.exports.handler = serverless(app);

// let isConnected = false;

// const connectToDatabase = async () => {
//   if (isConnected) {
//     return;
//   }
//   try {
//     console.log("Console 7 MongoDB URL log:", process.env.MONGO_URL);
//     await mongoose.connect(process.env.MONGO_URL, {
//       useNewUrlParser: true,
//       useUnifiedTopology: true,

//     });
//     isConnected = true;
//     console.log("Console 8 MongoDB connected successfully");
//   } catch (err) {
//     console.error("Console 9 Database connection failed:", err);
//     throw err;
//   }
// };

// console.log("Console 10 last log before export");

// module.exports.handler = serverless(async (event, context) => {
//   await connectToDatabase();
//   return app(event, context);
// });
