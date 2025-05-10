const { Router } = require("express");
const { assignTagToContact } = require("../controllers/assignedContactTag");
const router = Router();

router.post("/", assignTagToContact);

module.exports = router;
