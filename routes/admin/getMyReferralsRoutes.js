const { Router } = require("express");
const { getMyReferrals } = require("../controllers/getMyReferralsController");

const router = Router();

router.get("/", getMyReferrals);

module.exports = router;
