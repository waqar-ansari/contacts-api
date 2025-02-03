const express = require("express");
const app = express();
const mongoose = require("mongoose");
mongoose
  .connect("mongodb://localhost:27017/contacts-api")
  .then(() => {
    console.log("Connected to Database");
  })
  .catch((err) => {
    console.log(err);
  });
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  return res.send("home");
});
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });