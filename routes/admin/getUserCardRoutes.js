// routes/shareProfile.js
const express = require("express");
const router = express.Router();
const { getUserInfo } = require("../controllers/getUserCardController");

router.get("/:profileId", getUserInfo);

module.exports = router;
