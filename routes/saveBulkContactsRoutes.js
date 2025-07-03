// routes/userRoutes.js
const express = require("express");
const { saveBulkContacts } = require("../controllers/saveBulkContactsController");
const router = express.Router();

router.post("/", saveBulkContacts);

module.exports = router;
