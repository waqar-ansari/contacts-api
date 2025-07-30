const { Router } = require("express");
const { deleteMeeting } = require("../controllers/deleteMeetingController");
const router = Router();

router.delete("/", deleteMeeting);

module.exports = router;