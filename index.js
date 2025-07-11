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
const deleteAllContactRoutes = require("./routes/deleteAllContactRoutes");
const { error } = require("console");
const PORT = process.env.PORT;

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
app.use("/editProfile", checkForAuthentication(), upload.single("profileImage"),
  editProfileRoutes);
app.use("/deleteContact", deleteContactRoutes);
app.use("/deleteUser", checkForAuthentication(), deleteUserRoutes);
app.use("/deleteTask", checkForAuthentication(), deleteTaskRoutes);
app.use("/deleteMeeting", checkForAuthentication(), deleteMeetingRoutes);
app.use("/deleteTemplate", checkForAuthentication(), deleteTemplateRoutes);
app.use("/getUser", checkForAuthentication(), getUserRoutes);
app.use("/addTag", checkForAuthentication(), addTagRoutes);
app.use("/editTag", checkForAuthentication(), editTagRoutes);
app.use("/getTag", checkForAuthentication(), getTagRoutes);
app.use("/deleteTag", checkForAuthentication(), deleteTagRoutes);
app.use("/addToFavourite", checkForAuthentication(), addToFavouriteRoutes);
app.use("/getContact", checkForAuthentication(), getContactRoutes);
app.use("/getContactEmail", checkForAuthentication(), getContactEmailRoutes);
app.use("/getProfileEvent", checkForAuthentication(), getProfileEventRoutes);

// app.use("/googleConnect", checkForAuthentication(), googleConnect);

app.use("/connect", (req, res, next) => {
  const skipAuthPaths = ["/google-callback", "/microsoft-callback"];
  if (skipAuthPaths.includes(req.path)) {
    return next(); // No token required for callback
  }
  return checkForAuthentication()(req, res, next);
}, accountConnect);

app.use(
  "/addEditContact",
  checkForAuthentication(),
  upload.single("contactImage"),
  contactRoutes
);
app.use("/assignedContactTag", checkForAuthentication(), assignedContactTag);
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
app.use("/check-duplicate-user", checkForAuthentication(), checkEmailPhoneDuplicate);
app.use("/save-bulk-contacts", checkForAuthentication(), saveBulkContactsRoutes);
app.use("/getContactById", checkForAuthentication(), getContactByIdRoutes);
app.use("/getAllContact", checkForAuthentication(), getAllContactRoutes);
app.use("/getContactActivities", checkForAuthentication(), getContactActivitiesRoutes);
app.use("/deleteAllContacts", checkForAuthentication(), deleteAllContactRoutes);
// app.use("/fetch-google-contacts", checkForAuthentication(), fetchGoogleContacts);
app.use("/fetch-google-contacts", (req, res, next) => {
  const skipAuthPaths = ["/google/callback"];
  if (skipAuthPaths.includes(req.path)) {
    return next(); // No token required for callback
  }
  return checkForAuthentication()(req, res, next);
}, fetchGoogleContacts);
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
