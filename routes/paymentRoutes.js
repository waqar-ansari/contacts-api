const express = require("express");
const router = express.Router();
const {
  getCreditBalance,
  toggleAutoRenewal,
  getPaymentStatus,
  // createCheckoutSession,
  // createHostedCheckoutSession,
  // getCheckoutSessionDetails,
  // completeSubscription,
  upgradeSubscription,
  previewUpgrade,
  previewNewSubscription,
  downgradeSubscription,
  getPaymentMethods,
  addPaymentMethod,
  setDefaultPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  createSubscriptionWithPaymentMethod,
  getBillingHistory,
  getInvoiceDetails,
} = require("../controllers/paymentController");

const {
  validateCouponCode,
  // previewCouponDiscount,
} = require("../controllers/couponController");


/// Payment Routes in use

// POST preview upgrade cost and proration details
router.post("/preview-upgrade", previewUpgrade);

// POST preview new subscription cost for users without active subscriptions
router.post("/preview-new-subscription", previewNewSubscription);

// POST validate coupon code
router.post("/validate-coupon", validateCouponCode);

// GET user payment status and plan information
router.get("/status", getPaymentStatus);


// GET user's Stripe credit balance
router.get("/credit-balance", getCreditBalance);

// GET user's payment methods
router.get("/payment-methods", getPaymentMethods);


// POST toggle auto-renewal setting (alternative endpoint)
router.post("/toggle-auto-renewal", toggleAutoRenewal);


// POST upgrade existing subscription to new plan
router.post("/upgrade-subscription", upgradeSubscription);


// POST downgrade existing subscription to lower plan (scheduled at period end)
router.post("/downgrade-subscription", downgradeSubscription);

// POST create new subscription with existing payment method
router.post(
  "/create-subscription-with-payment-method",
  createSubscriptionWithPaymentMethod
);

// GET user's billing history
router.get("/billing-history", getBillingHistory);

// POST add new payment method
router.post("/add-payment-method", addPaymentMethod);


// POST set default payment method
router.post("/set-default-payment-method", setDefaultPaymentMethod);

// PUT update payment method
router.put("/update-payment-method", updatePaymentMethod);

// DELETE remove payment method
router.delete("/delete-payment-method/:paymentMethodId", deletePaymentMethod);

// GET individual invoice details
router.get("/invoice/:invoiceId", getInvoiceDetails);


















///old/deprecated routes

// // POST create checkout session for NEW subscription purchase
// router.post("/create-checkout-session", createCheckoutSession);

// // POST create hosted checkout session for NEW subscription purchase
// router.post("/create-hosted-checkout-session", createHostedCheckoutSession);

// // GET checkout session details by session ID
// router.get("/checkout-session/:sessionId", getCheckoutSessionDetails);

// // POST complete subscription after successful checkout
// router.post("/complete-subscription", completeSubscription);

// // POST preview coupon discount for given amount
// router.post("/preview-coupon-discount", previewCouponDiscount);

module.exports = router;
