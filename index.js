require("dotenv").config();
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
const getTagRoutes = require("./routes/getTagRoutes");
const getUserRoutes = require("./routes/getUserRoutes");
const deleteTagRoutes = require("./routes/deleteTagRoutes");
const addToFavouriteRoutes = require("./routes/addToFavouriteRoutes");
const signRoutes = require("./routes/signRoutes");
const authRoutes = require("./routes/authRoutes");
const changePasswordRoutes = require("./routes/changePasswordRoutes");
const { checkForAuthentication } = require("./middlewares/authentication");
const scanRoutes = require("./routes/scanRoutes");
const reminderRoutes = require("./routes/reminderRoutes");
const { error } = require("console");
const PORT = process.env.PORT;

app.use(cors());

app.use(express.json());
app.use(express.static(path.resolve("./public")));
app.use("/user", userRoutes);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));

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
app.use("/addTag", checkForAuthentication(), upload.fields([{ name: "icons", maxCount: 10 }]), // <-- fix here
  addTagRoutes);
app.use("/getTag", checkForAuthentication(), getTagRoutes);
app.use("/deleteTag", checkForAuthentication(), deleteTagRoutes);
app.use("/addToFavourite", checkForAuthentication(), addToFavouriteRoutes);
app.use("/getContact", checkForAuthentication(), getContactRoutes);
app.use("/getContactEmail", checkForAuthentication(), getContactEmailRoutes);
app.use("/getProfileEvent", checkForAuthentication(), getProfileEventRoutes);
// app.use("/addEditContact", checkForAuthentication(), contactRoutes);
app.use(
  "/addEditContact",
  checkForAuthentication(),
  upload.single("contactImage"),
  upload.fields([{ name: "icons", maxCount: 10 }]),
  contactRoutes
);
app.use("/assignedContactTag", checkForAuthentication(), assignedContactTag);


app.use("/sign", checkForAuthentication(), signRoutes);
app.use("/api", authRoutes);
app.use("/changePassword", checkForAuthentication(), changePasswordRoutes);
app.use("/api/scan", checkForAuthentication(), scanRoutes);
app.use("/reminders", checkForAuthentication(), reminderRoutes);

app.use("/check", (req, res) => {
  res.json({ message: "API checkPage" });
});
app.use("/", (req, res) => {
  console.log("hello from homepage");

  res.json({ message: "API Homepage" });
});
(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log("Connected to Database");
    app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
  } catch (err) {
    console.error("Database connection failed:", err);
  }
})();
module.exports.handler = serverless(app);
