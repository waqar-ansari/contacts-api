const { stripe } = require("../config/stripe");
const User = require("../models/userModel");
const Plan = require("../models/planModel");
const Payment = require("../models/paymentModel");

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

    // Update user with new subscription data
    await User.findByIdAndUpdate(userId, {
      plan: plan._id,
      isPremium: plan.name !== "Starter",
      hasUsedProTrial: plan.name === "Pro" ? true : user.hasUsedProTrial,
      stripeSubscriptionId: subscription.id,
    });

    console.log(
      `✅ Webhook: Successfully created subscription for user ${userId}, plan: ${plan.name}`
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

    // Handle plan changes from subscription metadata
    if (subscription.metadata && subscription.metadata.planId) {
      const planId = subscription.metadata.planId;

      // Validate the plan exists
      const plan = await Plan.findById(planId);
      if (plan) {
        console.log(
          `Updating user ${user._id} plan to ${plan.name} via webhook`
        );

        // Update user's plan in database
        await User.findByIdAndUpdate(user._id, {
          plan: plan._id,
          // isPremium: plan.name !== "Starter",
          stripeSubscriptionId: subscription.id, // Ensure subscription ID is set
        });

        console.log(`✅ Updated user ${user._id} plan to ${plan.name}`);
      } else {
        console.error(`Plan not found with ID: ${planId}`);
      }
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

    // Revert to starter plan
    await User.findByIdAndUpdate(user._id, {
      plan: starterPlan._id,
      isPremium: false,
      autoRenewal: false,
      // onFreeTrial: false,
      stripeSubscriptionId: null,
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

    // Find user by subscription ID
    const user = await User.findOne({
      stripeSubscriptionId: invoice.subscription,
    }).populate("plan");

    if (!user) {
      console.error("User not found for subscription:", invoice.subscription);
      return;
    }

    // Get subscription details from Stripe to access metadata
    const subscription = await stripe.subscriptions.retrieve(
      invoice.subscription
    );

    // Determine if this is a renewal or initial payment
    const isRenewal = invoice.billing_reason === "subscription_cycle";
    const isInitialPayment = invoice.billing_reason === "subscription_create";
    const isUpgrade = invoice.billing_reason === "subscription_update";

    // Create payment record
    const paymentData = {
      userId: user._id,
      planId: user.plan._id,
      paymentMethod: "stripe",
      amounts: {
        totalAmount: invoice.amount_paid, // Amount already in cents
        creditUsed: 0,
        stripeAmount: invoice.amount_paid,
        upgradeCost: isUpgrade ? invoice.amount_paid : invoice.amount_paid,
        remainingValue: 0,
      },
      stripe: {
        paymentIntentId: invoice.payment_intent,
        paymentStatus: "succeeded",
        transactionId: invoice.id,
      },
      isUpgrade: isUpgrade,
      isRenewal: isRenewal,
      isAutoRenewal: !subscription.cancel_at_period_end,
      newPlan: {
        activatedAt: new Date(invoice.period_start * 1000),
        expiresAt: new Date(invoice.period_end * 1000),
        autoRenewal: !subscription.cancel_at_period_end,
      },
      status: "completed",
      processedAt: new Date(),
      completedAt: new Date(),
      metadata: {
        currency: invoice.currency.toUpperCase(),
        notes: `${
          isRenewal
            ? "Subscription renewal"
            : isUpgrade
            ? "Subscription upgrade"
            : "Initial subscription payment"
        } via Stripe webhook`,
      },
    };

    // Add upgrade metadata if available
    if (subscription.metadata && subscription.metadata.upgradeType) {
      paymentData.metadata.upgradeType = subscription.metadata.upgradeType;
    }

    // Create the payment record
    const payment = new Payment(paymentData);
    await payment.save();

    console.log(
      `✅ Webhook: Successfully processed payment for user ${user._id}, invoice: ${invoice.id}, payment record: ${payment.paymentId}`
    );

    // Log specific payment type
    if (isRenewal) {
      console.log(`💰 Subscription renewed for user ${user._id}`);
    } else if (isUpgrade) {
      console.log(`⬆️ Subscription upgraded for user ${user._id}`);
    } else if (isInitialPayment) {
      console.log(`🎉 Initial subscription payment for user ${user._id}`);
    }
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

    // Find user by subscription ID
    const user = await User.findOne({
      stripeSubscriptionId: invoice.subscription,
    });

    if (!user) {
      console.error("User not found for subscription:", invoice.subscription);
      return;
    }

    // Log the failed payment - specific status handling done when fetching from Stripe
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
