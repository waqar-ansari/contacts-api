const express = require("express");
const router = express.Router();
const { completeUserInfo } = require("../controllers/userInfoController");

router.post("/", completeUserInfo);
module.exports = router;
