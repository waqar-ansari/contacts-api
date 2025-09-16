const express = require("express");
const router = express.Router();
const {
  createSubscription,
  // purchaseWithCredits,
  toggleAutoRenewal,
  getPaymentStatus,
} = require("../controllers/paymentController");

// GET user payment status and plan information
router.get("/status", getPaymentStatus);

// POST create subscription for plan purchase/upgrade
router.post("/create-subscription", createSubscription);

// POST purchase plan using credits only
// router.post("/purchase-with-credits", purchaseWithCredits);

// PATCH toggle auto-renewal setting
router.patch("/auto-renewal", toggleAutoRenewal);

module.exports = router;
