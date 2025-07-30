const express = require("express");
const router = express.Router();
const { getAllUsersAndAdmins } = require("../../controllers/admin/getAllUserAndAdmin");
// const authenticateToken = require("../middlewares/authenticateToken"); // your JWT auth middleware

router.get("/", getAllUsersAndAdmins);

module.exports = router;
