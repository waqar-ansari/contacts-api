const express = require("express");
const router = express.Router();
const { incrementBusinessCardScan } = require("../controllers/businessCardCountController");

// POST: increment business card scan count
router.post("/", incrementBusinessCardScan);

module.exports = router;
