const express = require("express");
const router = express.Router();
// const multer = require("multer");
const { createHelpSupport, getUserHelpRequests } = require("../controllers/helpSupportController");

// const upload = multer({ storage: multer.memoryStorage() });

router.post(
    "/create", createHelpSupport
);

router.get(
    "/get", getUserHelpRequests
);

module.exports = router;
