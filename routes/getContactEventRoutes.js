const { Router } = require("express");
const { getContactEvents } = require("../controllers/getContactEventController");

const router = Router();


router.post("/", getContactEvents);

module.exports = router;