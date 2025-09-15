const express = require("express");
const router = express.Router();
const {
  createPaymentIntent,
  purchaseWithCredits,
  confirmPayment,
  toggleAutoRenewal,
  getPaymentStatus,
} = require("../controllers/paymentController");

// GET user payment status and plan information
router.get("/status", getPaymentStatus);

// POST create payment intent for plan purchase/upgrade
router.post("/create-intent", createPaymentIntent);

// POST purchase plan using credits only
router.post("/purchase-with-credits", purchaseWithCredits);

// POST confirm payment after successful Stripe payment
router.post("/confirm", confirmPayment);

// PATCH toggle auto-renewal setting
router.patch("/auto-renewal", toggleAutoRenewal);

module.exports = router;
