require("dotenv").config()
const express = require("express");
const app = express();
const path = require("path");
const mongoose = require("mongoose");

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
const deleteTagRoutes = require("./routes/deleteTagRoutes");
const addToFavouriteRoutes = require("./routes/addToFavouriteRoutes");
const whoScannedMeRoutes = require("./routes/whoScannedMeRoutes");
const iScannedWhoRoutes = require("./routes/iScannedWhoRoutes");
const { checkForAuthentication } = require("./middlewares/authentication");
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => {
    console.log("Connected to Database");
  })
  .catch((err) => {
    console.log(err);
  });
const PORT = process.env.PORT;

app.use(express.json());
app.use(express.static(path.resolve("./public")));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

app.use("/edit-profile_api", checkForAuthentication(), editProfileRoutes);
app.use("/user", userRoutes);
app.use("/delete-contact_api", deleteContactRoutes);
app.use("/delete-user_api",checkForAuthentication(), deleteUserRoutes);
app.use("/add-tag_api", checkForAuthentication(), addTagRoutes);
app.use("/get-tag_api", checkForAuthentication(), getTagRoutes);
app.use("/delete-tag_api", checkForAuthentication(), deleteTagRoutes);
app.use("/addtofavourite_api", checkForAuthentication(), addToFavouriteRoutes);
app.use("/get-contact_api", checkForAuthentication(), getContactRoutes);
app.use("/add-edit-contact_api", checkForAuthentication(), contactRoutes);
app.use("/whoScannedMe", checkForAuthentication(), whoScannedMeRoutes);
app.use("/iScannedWho", checkForAuthentication(), iScannedWhoRoutes);

// app.use("/api/v1", v1Router);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
