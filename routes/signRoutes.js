const { Router } = require("express");
const { applePaymentSign } = require("../controllers/signControllers");
const multer = require("multer");
const router = Router();
const upload = multer({ dest: "uploads/" });

router.post("/",upload.single("manifest"), applePaymentSign);

module.exports = router;
