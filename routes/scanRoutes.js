const express = require("express");
const router = express.Router();
const { scanUser, getScanData } = require("../controllers/scanController");

router.post("/", scanUser); // POST /api/scan
router.get("/get_data", getScanData); // GET /api/scan/:userId

module.exports = router;
