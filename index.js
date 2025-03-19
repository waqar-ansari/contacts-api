require("dotenv").config()
const express = require("express");
const app = express();
const path = require("path");
const mongoose = require("mongoose");
// const v1Router = express.Router();
const serverless = require("serverless-http");

const swaggerUi = require("swagger-ui-express");
const swaggerDocs = require("./swaggerConfig");
const userRoutes = require("./routes/userRoutes");
const editProfileRoutes = require("./routes/editProfileRoutes");
const contactRoutes = require("./routes/contactRoutes");
const getContactRoutes = require("./routes/getContactRoutes");
const deleteContactRoutes = require("./routes/deleteContactRoutes");

const deleteUserRoutes = require("./routes/deleteUserRoutes");
const addTagRoutes = require("./routes/addTagRoutes");
const getTagRoutes = require("./routes/getTagRoutes");
const getUserRoutes = require("./routes/getUserRoutes");
const deleteTagRoutes = require("./routes/deleteTagRoutes");
const addToFavouriteRoutes = require("./routes/addToFavouriteRoutes");
const whoScannedMeRoutes = require("./routes/whoScannedMeRoutes");
const iScannedWhoRoutes = require("./routes/iScannedWhoRoutes");
const { checkForAuthentication } = require("./middlewares/authentication");

const PORT = process.env.PORT;

app.use(express.json());
app.use(express.static(path.resolve("./public")));
app.use("/user", userRoutes);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

app.use("/editProfile", checkForAuthentication(), editProfileRoutes);
app.use("/deleteContact", deleteContactRoutes);
app.use("/deleteUser",checkForAuthentication(), deleteUserRoutes);
app.use("/getUser",checkForAuthentication(), getUserRoutes);
app.use("/addTag", checkForAuthentication(), addTagRoutes);
app.use("/getTag", checkForAuthentication(), getTagRoutes);
app.use("/deleteTag", checkForAuthentication(), deleteTagRoutes);
app.use("/addToFavourite", checkForAuthentication(), addToFavouriteRoutes);
app.use("/getContact", checkForAuthentication(), getContactRoutes);
app.use("/addEditContact", checkForAuthentication(), contactRoutes);
app.use("/whoScannedMe", checkForAuthentication(), whoScannedMeRoutes);
app.use("/iScannedWho", checkForAuthentication(), iScannedWhoRoutes);

// app.use("/api/v1", v1Router);
// app.use("/", (req,res)=>{
//   res.json({ message: "API HomePage" });
// });

app.use("/check", (req,res)=>{
  res.json({ message: "API checkPage" });
});
app.use("/", (req,res)=>{
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
// module.exports.handler = serverless(app)
