require("dotenv").config()
const express = require("express");
const app = express();
const path = require("path");
const mongoose = require("mongoose");
const v1Router = express.Router();
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

v1Router.use("/edit-profile_api", checkForAuthentication(), editProfileRoutes);
v1Router.use("/user", userRoutes);
v1Router.use("/delete-contact_api", deleteContactRoutes);
v1Router.use("/delete-user_api",checkForAuthentication(), deleteUserRoutes);
v1Router.use("/add-tag_api", checkForAuthentication(), addTagRoutes);
v1Router.use("/get-tag_api", checkForAuthentication(), getTagRoutes);
v1Router.use("/delete-tag_api", checkForAuthentication(), deleteTagRoutes);
v1Router.use("/addtofavourite_api", checkForAuthentication(), addToFavouriteRoutes);
v1Router.use("/get-contact_api", checkForAuthentication(), getContactRoutes);
v1Router.use("/add-edit-contact_api", checkForAuthentication(), contactRoutes);
v1Router.use("/whoScannedMe", checkForAuthentication(), whoScannedMeRoutes);
v1Router.use("/iScannedWho", checkForAuthentication(), iScannedWhoRoutes);

app.use("/api/v1", v1Router);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
