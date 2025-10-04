const express = require("express");
const router = express.Router();
const { handleStripeWebhook } = require("../webhooks/stripeWebhook");

/**
 * Stripe webhook endpoint
 * This endpoint receives webhook events from Stripe, specifically for handling
 * checkout.session.completed events to ensure subscription completion
 *
 * IMPORTANT: This route requires raw body for signature verification
 * Make sure this route is defined BEFORE express.json() middleware
 *
 * @route POST /webhooks/stripe
 * @access Public (but verified with Stripe signature)
 */
router.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);

module.exports = router;
