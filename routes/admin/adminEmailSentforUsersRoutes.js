// routes/adminEmailRoutes.js
const express = require("express");
const router = express.Router();
const adminEmailController = require("../../controllers/admin/adminEmailSentforUserController");


// POST /api/admin/send-emails
router.post("/send-emails", /* isAdmin, */ adminEmailController.sendEmailToFilteredUsers);

router.get("/get-email", /* isAdmin, */  adminEmailController.getAllSentEmails);

module.exports = router;
