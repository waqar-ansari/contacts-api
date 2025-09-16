const { stripe } = require("../config/stripe");
const User = require("../models/userModel");
const Plan = require("../models/planModel");
const {
  calculateExpiryDate,
  applyStoredRemainingDaysUtil,
} = require("../utils/planUtils");
const {
  updateUserSubscriptionData,
  clearUserSubscriptionData,
} = require("../utils/stripeUtils");

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
      // Subscription events
      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        break;

      // Invoice events (for subscription billing)
      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event.data.object);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object);
        break;

      // Payment method events
      case "setup_intent.succeeded":
        await handleSetupIntentSucceeded(event.data.object);
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
 * Handle subscription creation
 */
const handleSubscriptionCreated = async (subscription) => {
  try {
    console.log("Subscription created:", subscription.id);

    const { userId, planId } = subscription.metadata;

    if (!userId || !planId) {
      console.error("Missing required metadata in subscription");
      return;
    }

    // Get user and plan
    const [user, plan] = await Promise.all([
      User.findById(userId).populate("plan"),
      Plan.findById(planId),
    ]);

    if (!user || !plan) {
      console.error(
        "User or plan not found for subscription:",
        subscription.id
      );
      return;
    }

    // Store remaining days from current plan if upgrading
    let updatedRemainingDays = [...(user.remainingDays || [])];
    if (
      user.plan &&
      user.planExpiresAt &&
      subscription.metadata.isUpgrade === "true"
    ) {
      const remainingDays = Math.max(
        0,
        Math.ceil((user.planExpiresAt - new Date()) / (1000 * 60 * 60 * 24))
      );

      if (remainingDays > 0) {
        const existingIndex = updatedRemainingDays.findIndex(
          (item) => item.planId.toString() === user.plan._id.toString()
        );

        if (existingIndex !== -1) {
          updatedRemainingDays[existingIndex].days += remainingDays;
        } else {
          updatedRemainingDays.push({
            planId: user.plan._id,
            days: remainingDays,
            storedAt: new Date(),
            planSnapshot: {
              name: user.plan.name,
              price: user.plan.price,
              pricePeriod: user.plan.pricePeriod,
            },
          });
        }
      }
    }

    // Calculate expiry date and apply remaining days
    const baseExpiryDate = new Date(subscription.current_period_end * 1000);
    const { newExpiryDate, updatedRemainingDays: finalRemainingDays } =
      applyStoredRemainingDaysUtil(
        { remainingDays: updatedRemainingDays },
        baseExpiryDate
      );

    // Update user with new subscription data
    await User.findByIdAndUpdate(userId, {
      plan: plan._id,
      planActivatedAt: new Date(subscription.current_period_start * 1000),
      planExpiresAt: newExpiryDate,
      isPremium: plan.name !== "Starter",
      autoRenewal: true,
      remainingDays: finalRemainingDays || [],
      trialStart: subscription.trial_start
        ? new Date(subscription.trial_start * 1000)
        : null,
      trialEnd: subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null,
      onFreeTrial: subscription.status === "trialing",
      hasUsedProTrial: plan.name === "Pro" ? true : user.hasUsedProTrial,
      stripeSubscriptionId: subscription.id,
      stripeSubscriptionStatus: subscription.status,
      stripeCurrentPeriodStart: new Date(
        subscription.current_period_start * 1000
      ),
      stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
      stripeCancelAtPeriodEnd: subscription.cancel_at_period_end,
    });

    console.log(
      `Webhook: Successfully created subscription for user ${userId}`
    );
  } catch (error) {
    console.error("Error handling subscription created:", error);
  }
};

/**
 * Handle subscription updates
 */
const handleSubscriptionUpdated = async (subscription) => {
  try {
    console.log("Subscription updated:", subscription.id);

    // Find user by subscription ID
    const user = await User.findOne({ stripeSubscriptionId: subscription.id });

    if (!user) {
      console.error("User not found for subscription:", subscription.id);
      return;
    }

    // Update subscription data
    await updateUserSubscriptionData(user._id, subscription);

    // If subscription was canceled, update user accordingly
    if (subscription.status === "canceled") {
      await handleSubscriptionCancellation(user, subscription);
    }

    console.log(
      `Webhook: Successfully updated subscription for user ${user._id}`
    );
  } catch (error) {
    console.error("Error handling subscription updated:", error);
  }
};

/**
 * Handle subscription deletion/cancellation
 */
const handleSubscriptionDeleted = async (subscription) => {
  try {
    console.log("Subscription deleted:", subscription.id);

    // Find user by subscription ID
    const user = await User.findOne({ stripeSubscriptionId: subscription.id });

    if (!user) {
      console.error("User not found for subscription:", subscription.id);
      return;
    }

    await handleSubscriptionCancellation(user, subscription);

    console.log(
      `Webhook: Successfully handled subscription deletion for user ${user._id}`
    );
  } catch (error) {
    console.error("Error handling subscription deleted:", error);
  }
};

/**
 * Handle subscription cancellation logic
 */
const handleSubscriptionCancellation = async (user, subscription) => {
  try {
    // Get starter plan
    const starterPlan = await Plan.findOne({ name: "Starter", isActive: true });

    if (!starterPlan) {
      console.error("Starter plan not found");
      return;
    }

    // Store remaining days from current plan
    let updatedRemainingDays = [...(user.remainingDays || [])];
    const currentPlan = await Plan.findById(user.plan);

    if (currentPlan && user.planExpiresAt) {
      const remainingDays = Math.max(
        0,
        Math.ceil((user.planExpiresAt - new Date()) / (1000 * 60 * 60 * 24))
      );

      if (remainingDays > 0) {
        const existingIndex = updatedRemainingDays.findIndex(
          (item) => item.planId.toString() === currentPlan._id.toString()
        );

        if (existingIndex !== -1) {
          updatedRemainingDays[existingIndex].days += remainingDays;
        } else {
          updatedRemainingDays.push({
            planId: currentPlan._id,
            days: remainingDays,
            storedAt: new Date(),
            planSnapshot: {
              name: currentPlan.name,
              price: currentPlan.price,
              pricePeriod: currentPlan.pricePeriod,
            },
          });
        }
      }
    }

    // Revert to starter plan
    await User.findByIdAndUpdate(user._id, {
      plan: starterPlan._id,
      planActivatedAt: null,
      planExpiresAt: null,
      isPremium: false,
      autoRenewal: false,
      remainingDays: updatedRemainingDays,
      onFreeTrial: false,
      trialStart: null,
      trialEnd: null,
      stripeSubscriptionId: null,
      stripeSubscriptionStatus: null,
      stripeCurrentPeriodStart: null,
      stripeCurrentPeriodEnd: null,
      stripeCancelAtPeriodEnd: false,
    });
  } catch (error) {
    console.error("Error handling subscription cancellation:", error);
  }
};

/**
 * Handle successful invoice payment (subscription renewals)
 */
const handleInvoicePaymentSucceeded = async (invoice) => {
  try {
    console.log("Invoice payment succeeded:", invoice.id);

    if (!invoice.subscription) {
      return; // Not a subscription invoice
    }

    // Get the subscription
    const subscription = await stripe.subscriptions.retrieve(
      invoice.subscription
    );

    // Find user by subscription ID
    const user = await User.findOne({ stripeSubscriptionId: subscription.id });

    if (!user) {
      console.error("User not found for subscription:", subscription.id);
      return;
    }

    // Update subscription data (renewal)
    await updateUserSubscriptionData(user._id, subscription);

    console.log(
      `Webhook: Successfully renewed subscription for user ${user._id}`
    );
  } catch (error) {
    console.error("Error handling invoice payment succeeded:", error);
  }
};

/**
 * Handle failed invoice payment (failed renewals)
 */
const handleInvoicePaymentFailed = async (invoice) => {
  try {
    console.log("Invoice payment failed:", invoice.id);

    if (!invoice.subscription) {
      return; // Not a subscription invoice
    }

    // Get the subscription
    const subscription = await stripe.subscriptions.retrieve(
      invoice.subscription
    );

    // Find user by subscription ID
    const user = await User.findOne({ stripeSubscriptionId: subscription.id });

    if (!user) {
      console.error("User not found for subscription:", subscription.id);
      return;
    }

    // Update subscription status
    await updateUserSubscriptionData(user._id, subscription);

    // If subscription is past_due or unpaid, you might want to take action
    if (
      subscription.status === "past_due" ||
      subscription.status === "unpaid"
    ) {
      console.log(
        `Subscription ${subscription.id} is ${subscription.status} for user ${user._id}`
      );
      // You can implement notification logic here
    }

    console.log(`Webhook: Handled failed payment for user ${user._id}`);
  } catch (error) {
    console.error("Error handling invoice payment failed:", error);
  }
};

/**
 * Handle setup intent success (payment method setup)
 */
const handleSetupIntentSucceeded = async (setupIntent) => {
  try {
    console.log("Setup intent succeeded:", setupIntent.id);
    // This can be used to track when customers successfully add payment methods
  } catch (error) {
    console.error("Error handling setup intent succeeded:", error);
  }
};

module.exports = {
  handleStripeWebhook,
};
