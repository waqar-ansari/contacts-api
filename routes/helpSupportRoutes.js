// const express = require("express");
// const router = express.Router();
const { Router } = require("express");
const router = Router();

const { createHelpSupport, getUserHelpRequests } = require("../controllers/helpSupportController");


router.post(
    "/create", createHelpSupport
);

router.get(
    "/get", getUserHelpRequests
);

module.exports = router;
