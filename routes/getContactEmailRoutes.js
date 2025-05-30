const { Router } = require("express");
const { getContactEmail } = require("../controllers/getContactEmailController");

const router = Router();

router.post("/", getContactEmail);

module.exports = router;
