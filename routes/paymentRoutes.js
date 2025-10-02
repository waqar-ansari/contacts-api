const express = require("express");
const router = express.Router();
const {
  getCreditBalance,
  toggleAutoRenewal,
  getPaymentStatus,
  createCheckoutSession,
  createHostedCheckoutSession,
  completeSubscription,
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
  previewCouponDiscount,
} = require("../controllers/couponController");

// GET user payment status and plan information
router.get("/status", getPaymentStatus);

// GET user's Stripe credit balance
router.get("/credit-balance", getCreditBalance);

// POST create checkout session for NEW subscription purchase
router.post("/create-checkout-session", createCheckoutSession);

// POST create hosted checkout session for NEW subscription purchase
router.post("/create-hosted-checkout-session", createHostedCheckoutSession);

// POST complete subscription after successful checkout
router.post("/complete-subscription", completeSubscription);

// POST preview upgrade cost and proration details
router.post("/preview-upgrade", previewUpgrade);

// POST preview new subscription cost for users without active subscriptions
router.post("/preview-new-subscription", previewNewSubscription);

// POST upgrade existing subscription to new plan
router.post("/upgrade-subscription", upgradeSubscription);

// POST downgrade existing subscription to lower plan (scheduled at period end)
router.post("/downgrade-subscription", downgradeSubscription);

// POST create new subscription with existing payment method
router.post(
  "/create-subscription-with-payment-method",
  createSubscriptionWithPaymentMethod
);

// POST toggle auto-renewal setting (alternative endpoint)
router.post("/toggle-auto-renewal", toggleAutoRenewal);

// GET user's payment methods
router.get("/payment-methods", getPaymentMethods);

// POST add new payment method
router.post("/add-payment-method", addPaymentMethod);

// POST set default payment method
router.post("/set-default-payment-method", setDefaultPaymentMethod);

// PUT update payment method
router.put("/update-payment-method", updatePaymentMethod);

// DELETE remove payment method
router.delete("/delete-payment-method/:paymentMethodId", deletePaymentMethod);

// GET user's billing history
router.get("/billing-history", getBillingHistory);

// GET individual invoice details
router.get("/invoice/:invoiceId", getInvoiceDetails);

// POST validate coupon code
router.post("/validate-coupon", validateCouponCode);

// POST preview coupon discount for given amount
router.post("/preview-coupon-discount", previewCouponDiscount);

module.exports = router;
