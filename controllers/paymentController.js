const { stripe } = require("../config/stripe");
const Plan = require("../models/planModel");
const User = require("../models/userModel");
const Payment = require("../models/paymentModel");
const {
  getOrCreateStripeCustomer,
  createStripeSubscription,
  getStripeCreditBalance,
  useStripeCredits,
  updateUserSubscriptionData,
} = require("../utils/stripeUtils");
/**
 * Create subscription for plan purchase/upgrade
 * @route POST /api/user/payment/create-subscription
 * @access Private
 */
const createSubscription = async (req, res) => {
  try {
    const { planId, autoRenewal = true } = req.body; // Default to true if not specified
    const userId = req.user._id;

    // Validate plan
    const plan = await Plan.findById(planId);
    if (!plan || !plan.isActive) {
      return res.status(404).json({
        success: false,
        message: "Plan not found or inactive",
      });
    }

    // Check if plan has a Stripe price ID
    if (!plan.stripePriceId) {
      return res.status(400).json({
        success: false,
        message: "Plan is not configured for Stripe subscriptions",
      });
    }

    // Get user
    const user = await User.findById(userId).populate("plan");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Get or create Stripe customer
    const customer = await getOrCreateStripeCustomer(user);

    // Create Stripe subscription
    const subscriptionOptions = {
      cancel_at_period_end: !autoRenewal, // Set based on autoRenewal preference
      metadata: {
        userId: userId.toString(),
        planId: planId.toString(),
        planName: plan.name,
        autoRenewal: autoRenewal.toString(),
      },
    };

    // Add trial period for new Pro plan users
    if (plan.name === "Pro" && !user.hasUsedProTrial) {
      subscriptionOptions.trialPeriodDays = 14;
    }

    const subscription = await createStripeSubscription(
      customer.id,
      plan.stripePriceId,
      subscriptionOptions
    );

    res.json({
      success: true,
      paymentMethod: "stripe_subscription",
      clientSecret: subscription.latest_invoice.payment_intent.client_secret,
      planDetails: {
        planId: plan._id,
        planName: plan.name,
        planPrice: plan.price,
        trialDays: subscriptionOptions.trialPeriodDays || 0,
        autoRenewal: autoRenewal,
      },
      subscription: {
        id: subscription.id,
        status: subscription.status,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    });
  } catch (error) {
    console.error("Error creating subscription:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create subscription",
      error: error.message,
    });
  }
};

/**
 * Process plan purchase/upgrade using credits only
 * @route POST /api/user/payment/purchase-with-credits
 * @access Private
 */
/**
 * Purchase plan using Stripe billing credits
 * @route POST /api/user/payment/purchase-with-credits
 * @access Private
 */
const purchaseWithCredits = async (req, res) => {
  try {
    const { planId, autoRenewal = false } = req.body; // Default to false for credit purchases
    const userId = req.user._id;

    // Validate plan
    const plan = await Plan.findById(planId);
    if (!plan || !plan.isActive) {
      return res.status(404).json({
        success: false,
        message: "Plan not found or inactive",
      });
    }

    // Get user
    const user = await User.findById(userId).populate("plan");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Get or create Stripe customer
    const customer = await getOrCreateStripeCustomer(user);

    // Check Stripe credit balance
    const availableCredits = Math.abs(
      await getStripeCreditBalance(customer.id)
    );

    if (availableCredits < plan.price) {
      return res.status(400).json({
        success: false,
        message: "Insufficient Stripe credits",
        required: plan.price,
        available: availableCredits,
      });
    }

    // Use Stripe credits
    await useStripeCredits(
      customer.id,
      plan.price,
      `Payment for ${plan.name} plan`
    );

    // Create payment record
    const payment = new Payment({
      userId: userId,
      planId: plan._id,
      paymentMethod: "stripe_credits",
      amounts: {
        totalAmount: plan.price,
        creditUsed: plan.price,
        stripeAmount: 0,
        upgradeCost: plan.price,
        remainingValue: 0,
      },
      isUpgrade: false,
      status: "completed",
      completedAt: new Date(),
      metadata: {
        autoRenewal: autoRenewal,
        paymentType: "credit_purchase",
      },
    });

    // Save payment record
    await payment.save();

    // Get updated credit balance
    const newCreditBalance = Math.abs(
      await getStripeCreditBalance(customer.id)
    );

    res.json({
      success: true,
      message: "Plan purchased successfully with Stripe credits",
      credits: {
        used: plan.price,
        remaining: newCreditBalance,
      },
      transaction: {
        paymentId: payment.paymentId,
        method: "stripe_credits",
        amount: plan.price,
        planName: plan.name,
        autoRenewal: autoRenewal,
      },
    });
  } catch (error) {
    console.error("Error purchasing with credits:", error);
    res.status(500).json({
      success: false,
      message: "Failed to purchase plan",
      error: error.message,
    });
  }
};

/**
 * Confirm payment and update user plan after successful Stripe payment
 * Note: This function is mostly legacy - webhooks handle subscription updates
 * @route POST /api/user/payment/confirm
 * @access Private
 */
const confirmPayment = async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    const userId = req.user._id;

    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== "succeeded") {
      return res.status(400).json({
        success: false,
        message: "Payment not completed",
        status: paymentIntent.status,
      });
    }

    // Extract metadata
    const { planId, finalAmount, autoRenewal } = paymentIntent.metadata;

    // Validate plan
    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    // Get user
    const user = await User.findById(userId).populate("plan");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Create payment record
    const payment = new Payment({
      userId: userId,
      planId: plan._id,
      paymentMethod: "stripe",
      stripePaymentIntentId: paymentIntentId,
      amounts: {
        totalAmount: parseInt(finalAmount),
        creditUsed: 0,
        stripeAmount: parseInt(finalAmount),
        upgradeCost: parseInt(finalAmount),
        remainingValue: 0,
      },
      isUpgrade: false,
      status: "completed",
      completedAt: new Date(),
      metadata: {
        autoRenewal: autoRenewal || "true", // Default to true if not specified
        paymentType: "stripe_payment",
      },
    });

    // Save payment record
    await payment.save();

    res.json({
      success: true,
      message:
        "Payment confirmed successfully. Plan activation will be handled by webhooks.",
      transaction: {
        paymentId: payment.paymentId,
        paymentIntentId,
        method: "stripe",
        stripeAmount: parseInt(finalAmount),
        totalAmount: parseInt(finalAmount),
        planName: plan.name,
        autoRenewal: autoRenewal === "true",
      },
    });
  } catch (error) {
    console.error("Error confirming payment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to confirm payment",
      error: error.message,
    });
  }
};

/**
 * Toggle auto-renewal setting for user's Stripe subscription
 * @route PATCH /api/user/payment/auto-renewal
 * @access Private
 */
const toggleAutoRenewal = async (req, res) => {
  try {
    const { autoRenewal } = req.body;
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // If user has an active Stripe subscription, update it
    if (user.stripeSubscriptionId) {
      try {
        await stripe.subscriptions.update(user.stripeSubscriptionId, {
          cancel_at_period_end: !autoRenewal, // Cancel at period end if autoRenewal is false
        });

        // Update user's cancel at period end status
        await User.findByIdAndUpdate(userId, {
          stripeCancelAtPeriodEnd: !autoRenewal,
        });

        res.json({
          success: true,
          message: `Auto-renewal ${
            autoRenewal ? "enabled" : "disabled"
          } successfully`,
          autoRenewal: autoRenewal,
          cancelAtPeriodEnd: !autoRenewal,
        });
      } catch (stripeError) {
        console.error("Error updating Stripe subscription:", stripeError);
        res.status(500).json({
          success: false,
          message: "Failed to update subscription auto-renewal",
          error: stripeError.message,
        });
      }
    } else {
      res.status(400).json({
        success: false,
        message: "No active subscription found to modify",
      });
    }
  } catch (error) {
    console.error("Error toggling auto-renewal:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update auto-renewal setting",
      error: error.message,
    });
  }
};

/**
 * Get user's current plan and payment information
 * @route GET /api/user/payment/status
 * @access Private
 */
const getPaymentStatus = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId)
      .populate("plan")
      .select(
        "plan stripeCustomerId stripeSubscriptionId stripeSubscriptionStatus stripeCurrentPeriodStart stripeCurrentPeriodEnd stripeCancelAtPeriodEnd hasUsedProTrial"
      );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Get Stripe credit balance
    let creditBalance = 0;
    if (user.stripeCustomerId) {
      try {
        const stripeCreditBalance = await getStripeCreditBalance(
          user.stripeCustomerId
        );
        creditBalance = Math.abs(stripeCreditBalance) / 100; // Convert to dollars
      } catch (error) {
        console.error("Error getting Stripe credit balance:", error);
      }
    }

    // Get subscription details from Stripe if available
    let subscriptionDetails = null;
    if (user.stripeSubscriptionId) {
      try {
        const subscription = await stripe.subscriptions.retrieve(
          user.stripeSubscriptionId
        );
        subscriptionDetails = {
          id: subscription.id,
          status: subscription.status,
          currentPeriodStart: new Date(
            subscription.current_period_start * 1000
          ),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          trialEnd: subscription.trial_end
            ? new Date(subscription.trial_end * 1000)
            : null,
        };
      } catch (error) {
        console.error("Error getting Stripe subscription:", error);
      }
    }

    res.json({
      success: true,
      data: {
        plan: user.plan,
        creditBalance: creditBalance,
        hasUsedProTrial: user.hasUsedProTrial,
        subscription: subscriptionDetails,
        stripeCustomerId: user.stripeCustomerId,
      },
    });
  } catch (error) {
    console.error("Error getting payment status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get payment status",
      error: error.message,
    });
  }
};

module.exports = {
  createSubscription,
  purchaseWithCredits,
  confirmPayment,
  toggleAutoRenewal,
  getPaymentStatus,
};
