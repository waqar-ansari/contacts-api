// routes/contactRoutes.js
const express = require("express");
const router = express.Router();
const { getContactCounts } = require("../controllers/getContactCountController");

router.get("/", getContactCounts);

module.exports = router;
