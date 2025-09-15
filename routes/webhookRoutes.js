const express = require("express");
const router = express.Router();
const { handleStripeWebhook } = require("../controllers/webhookController");

// Stripe webhook endpoint
// Note: This should be before any middleware that parses JSON
// because Stripe needs the raw body for signature verification
router.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);

module.exports = router;
