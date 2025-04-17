const express = require("express");
const router = express.Router();
const { scanUser, getScanData } = require("../controllers/scanController");

router.post("/", scanUser); // POST /api/scan
router.get("/:userId", getScanData); // GET /api/scan/:userId

module.exports = router;
