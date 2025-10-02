// const express = require("express");
// const router = express.Router();
const { Router } = require("express");
const router = Router();

const {
  createHelpSupport,
  getUserHelpRequests,
  getTicketById,
  replyToTicket,
  deleteTicket,
} = require("../controllers/helpSupportController");

router.post("/create", createHelpSupport);
router.get("/get", getUserHelpRequests);
router.get("/:id", getTicketById);
router.post("/:id/reply", replyToTicket);
router.delete("/:id", deleteTicket);

module.exports = router;
