// const { Router } = require("express");
// const { applePaymentSign } = require("../controllers/signControllers");
// const multer = require("multer");
// const router = Router();
// const upload = multer({ dest: "uploads/" });

// router.post("/",upload.single("manifest"), applePaymentSign);

// module.exports = router;

const express = require("express");
const router = express.Router();
const { applePaymentSign } = require("../controllers/signControllers");

// POST /api/apple-wallet/sign
router.post("/", applePaymentSign);

module.exports = router;
