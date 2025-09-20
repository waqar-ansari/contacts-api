const express = require("express");
const router = express.Router();
const {
  createSubscription,
  purchaseWithCredits,
  getCreditBalance,
  toggleAutoRenewal,
  getPaymentStatus,
  createCheckoutSession,
  completeSubscription,
  upgradeSubscription,
  previewUpgrade,
} = require("../controllers/paymentController");

// GET user payment status and plan information
router.get("/status", getPaymentStatus);

// GET user's Stripe credit balance
router.get("/credit-balance", getCreditBalance);

// POST create subscription for plan purchase/upgrade
router.post("/create-subscription", createSubscription);

// POST create checkout session for NEW subscription purchase
router.post("/create-checkout-session", createCheckoutSession);

// POST complete subscription after successful checkout
router.post("/complete-subscription", completeSubscription);

// POST preview upgrade cost and proration details
router.post("/preview-upgrade", previewUpgrade);

// POST upgrade existing subscription to new plan
router.post("/upgrade-subscription", upgradeSubscription);

// POST purchase plan using credits only (for initial subscriptions)
router.post("/purchase-with-credits", purchaseWithCredits);

// PATCH toggle auto-renewal setting
router.patch("/auto-renewal", toggleAutoRenewal);

// POST toggle auto-renewal setting (alternative endpoint)
router.post("/toggle-auto-renewal", toggleAutoRenewal);

module.exports = router;
