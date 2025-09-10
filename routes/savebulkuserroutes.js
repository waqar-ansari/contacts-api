// routes/userRoutes.js
const express = require("express");
const { bulkUser } = require("../controllers/savebulkuser");
const router = express.Router();
console.log("inside the routes");

router.post("/", bulkUser);

module.exports = router;