const { stripe } = require("../config/stripe");
const User = require("../models/userModel");
const Plan = require("../models/planModel");
const { calculateExpiryDate } = require("../utils/planUtils");

/**
 * Handle Stripe webhook events
 * @route POST /api/webhooks/stripe
 * @access Public (but verified via Stripe signature)
 */
const handleStripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Handle the event
  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event.data.object);
        break;

      case "invoice.payment_succeeded":
        // Handle subscription renewal
        await handleInvoicePaymentSucceeded(event.data.object);
        break;

      case "invoice.payment_failed":
        // Handle failed subscription renewal
        await handleInvoicePaymentFailed(event.data.object);
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error("Error handling webhook:", error);
    res.status(500).json({ error: "Webhook handler failed" });
  }
};

/**
 * Handle successful payment intent
 * This is a backup in case the frontend doesn't call the confirm endpoint
 */
const handlePaymentIntentSucceeded = async (paymentIntent) => {
  try {
    console.log("Payment succeeded:", paymentIntent.id);

    const {
      userId,
      planId,
      creditUsage,
      finalAmount,
      isUpgrade,
      remainingValue,
      autoRenewal,
    } = paymentIntent.metadata;

    if (!userId || !planId) {
      console.error("Missing required metadata in payment intent");
      return;
    }

    // Check if this payment has already been processed
    const user = await User.findById(userId).populate("plan");
    if (!user) {
      console.error("User not found for payment intent:", paymentIntent.id);
      return;
    }

    // Validate plan
    const plan = await Plan.findById(planId);
    if (!plan) {
      console.error("Plan not found for payment intent:", paymentIntent.id);
      return;
    }

    // Calculate remaining days to store (for upgrades)
    let remainingDaysToStore = 0;
    if (isUpgrade === "true" && user.planExpiresAt) {
      const now = new Date();
      const diffTime = user.planExpiresAt - now;
      remainingDaysToStore = Math.max(
        0,
        Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      );
    }

    // Calculate new expiry date
    const now = new Date();
    const newExpiryDate = calculateExpiryDate(now, plan.pricePeriod);

    // Update user plan
    await User.findByIdAndUpdate(userId, {
      plan: plan._id,
      planActivatedAt: now,
      planExpiresAt: newExpiryDate,
      isPremium: plan.name !== "Starter",
      creditBalance: Math.max(
        0,
        (user.creditBalance || 0) - parseInt(creditUsage || 0)
      ),
      autoRenewal: autoRenewal === "true",
      remainingDays: remainingDaysToStore,
      trialStart: null,
      trialEnd: null,
      onFreeTrial: false,
    });

    console.log(
      `Webhook: Successfully updated user ${userId} plan to ${plan.name}`
    );
  } catch (error) {
    console.error("Error handling payment intent succeeded:", error);
  }
};

/**
 * Handle failed payment intent
 */
const handlePaymentIntentFailed = async (paymentIntent) => {
  try {
    console.log("Payment failed:", paymentIntent.id);

    const { userId } = paymentIntent.metadata;

    if (userId) {
      // You could implement logic here to notify the user of payment failure
      // or update their account status
      console.log(`Payment failed for user: ${userId}`);
    }
  } catch (error) {
    console.error("Error handling payment intent failed:", error);
  }
};

/**
 * Handle successful invoice payment (for subscriptions/auto-renewal)
 */
const handleInvoicePaymentSucceeded = async (invoice) => {
  try {
    console.log("Invoice payment succeeded:", invoice.id);

    // This would be used for subscription renewals
    // You can implement subscription logic here if needed
  } catch (error) {
    console.error("Error handling invoice payment succeeded:", error);
  }
};

/**
 * Handle failed invoice payment (for subscriptions/auto-renewal)
 */
const handleInvoicePaymentFailed = async (invoice) => {
  try {
    console.log("Invoice payment failed:", invoice.id);

    // This would be used for failed subscription renewals
    // You can implement logic to handle failed renewals here
  } catch (error) {
    console.error("Error handling invoice payment failed:", error);
  }
};

module.exports = {
  handleStripeWebhook,
};
