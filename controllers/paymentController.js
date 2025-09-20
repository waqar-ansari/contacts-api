const { stripe } = require("../config/stripe");
const Plan = require("../models/planModel");
const User = require("../models/userModel");
const Payment = require("../models/paymentModel");
const {
  getOrCreateStripeCustomer,
  createStripeSubscription,
  getStripeCreditBalance,
  useStripeCredits,
  getUserStripeSubscriptionData,
  getCustomerPrimarySubscription,
  getUserCurrentPlan,
} = require("../utils/stripeUtils");

/**
 * Validate plan upgrade based on price hierarchy
 * @param {Object} currentPlan - User's current plan
 * @param {Object} newPlan - Plan user wants to upgrade to
 * @returns {Object} Validation result
 */
const validatePlanUpgrade = (currentPlan, newPlan) => {
  const validation = {
    isValid: true,
    isUpgrade: false,
    isDowngrade: false,
    isSamePlan: false,
    message: "",
  };

  // If user has no current plan, any plan is valid
  if (!currentPlan) {
    validation.message = "Creating new subscription";
    return validation;
  }

  // Check if trying to subscribe to same plan
  if (currentPlan._id.toString() === newPlan._id.toString()) {
    validation.isValid = false;
    validation.isSamePlan = true;
    validation.message = "You already have this plan active";
    return validation;
  }

  const currentPrice = currentPlan.price;
  const newPrice = newPlan.price;

  if (newPrice > currentPrice) {
    // This is an upgrade
    validation.isUpgrade = true;
    validation.message = `Upgrading from ${currentPlan.name} to ${newPlan.name}`;
  } else if (newPrice < currentPrice) {
    // This is a downgrade - not allowed
    validation.isValid = false;
    validation.isDowngrade = true;
    validation.message = `Cannot downgrade from ${currentPlan.name} (${currentPrice}) to ${newPlan.name} (${newPrice}). Downgrades are not allowed.`;
  } else {
    // Same price different plan
    validation.message = `Changing from ${currentPlan.name} to ${newPlan.name}`;
  }

  return validation;
};

/**
 * Check if user has any active Stripe subscriptions
 * @param {Object} user - User object
 * @returns {Object} Active subscription info
 */
const checkActiveSubscription = async (user) => {
  const result = {
    hasActiveSubscription: false,
    subscriptionId: null,
    subscriptionStatus: null,
  };

  if (!user.stripeCustomerId) {
    return result;
  }

  try {
    const subscription = await getCustomerPrimarySubscription(
      user.stripeCustomerId
    );

    if (subscription) {
      result.hasActiveSubscription = true;
      result.subscriptionId = subscription.id;
      result.subscriptionStatus = subscription.status;
    }
  } catch (error) {
    console.log("Error checking active subscription:", error.message);
  }

  return result;
};
/**
 * Create subscription for plan purchase/upgrade
 * cannot directly/explicitly buy with credits, if there are enough credits, will automatically use those credits first
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

    // Get user and current plan from subscription
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Get current plan from active subscription
    const currentPlan = await getUserCurrentPlan(user);

    // Check for active subscription
    const activeSubInfo = await checkActiveSubscription(user);

    // Validate plan upgrade/change
    const validation = validatePlanUpgrade(currentPlan, plan);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.message,
      });
    }

    // Get or create Stripe customer
    const customer = await getOrCreateStripeCustomer(user);

    let subscription;

    if (!activeSubInfo.hasActiveSubscription) {
      // Create new subscription
      const subscriptionOptions = {
        cancel_at_period_end: !autoRenewal,
        metadata: {
          userId: userId.toString(),
          planId: planId.toString(),
          planName: plan.name,
          autoRenewal: autoRenewal.toString(),
        },
      };

      subscription = await createStripeSubscription(
        customer.id,
        plan.stripePriceId,
        subscriptionOptions
      );
    } else {
      // Update existing subscription for upgrade
      const currentSubscription = await stripe.subscriptions.retrieve(
        activeSubInfo.subscriptionId
      );

      subscription = await stripe.subscriptions.update(
        activeSubInfo.subscriptionId,
        {
          items: [
            {
              id: currentSubscription.items.data[0].id,
              price: plan.stripePriceId,
            },
          ],
          proration_behavior: "create_prorations", // Create prorations for upgrades
          metadata: {
            userId: userId.toString(),
            planId: planId.toString(),
            planName: plan.name,
            autoRenewal: autoRenewal.toString(),
            upgradeType: validation.isUpgrade ? "upgrade" : "change",
          },
        }
      );
    }

    const responseData = {
      success: true,
      paymentMethod: "stripe_subscription",
      planDetails: {
        planId: plan._id,
        planName: plan.name,
        planPrice: plan.price,
        trialDays: 0, // Trials only given on signup, not here
        autoRenewal: autoRenewal,
      },
      subscription: {
        id: subscription.id,
        status: subscription.status,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
      upgrade: {
        isUpgrade: validation.isUpgrade,
        message: validation.message,
      },
    };

    // Only include client_secret for new subscriptions that need payment
    if (
      !activeSubInfo.hasActiveSubscription &&
      subscription.latest_invoice?.payment_intent?.client_secret
    ) {
      responseData.clientSecret =
        subscription.latest_invoice.payment_intent.client_secret;
    }

    res.json(responseData);
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
// const purchaseWithCredits = async (req, res) => {
//   try {
//     const { planId, autoRenewal = false } = req.body; // Default to false for credit purchases
//     const userId = req.user._id;

//     // Validate plan
//     const plan = await Plan.findById(planId);
//     if (!plan || !plan.isActive) {
//       return res.status(404).json({
//         success: false,
//         message: "Plan not found or inactive",
//       });
//     }

//     // Get user
//     const user = await User.findById(userId).populate("plan");
//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//       });
//     }

//     // Check for active subscription
//     const activeSubInfo = await checkActiveSubscription(user);

//     // Validate plan upgrade/change
//     const validation = validatePlanUpgrade(user.plan, plan);
//     if (!validation.isValid) {
//       return res.status(400).json({
//         success: false,
//         message: validation.message,
//       });
//     }

//     // Prevent credit purchases if user has active subscription (should upgrade instead)
//     if (activeSubInfo.hasActiveSubscription) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "You have an active subscription. Please use the subscription upgrade flow instead of purchasing with credits.",
//       });
//     }

//     // Get or create Stripe customer
//     const customer = await getOrCreateStripeCustomer(user);

//     // Check Stripe credit balance
//     const availableCredits = Math.abs(
//       await getStripeCreditBalance(customer.id)
//     );

//     if (availableCredits < plan.price) {
//       return res.status(400).json({
//         success: false,
//         message: "Insufficient Stripe credits",
//         required: plan.price,
//         available: availableCredits,
//       });
//     }

//     // Use Stripe credits
//     await useStripeCredits(
//       customer.id,
//       plan.price,
//       `Payment for ${plan.name} plan`
//     );

//     // Create payment record
//     const payment = new Payment({
//       userId: userId,
//       planId: plan._id,
//       paymentMethod: "stripe_credits",
//       amounts: {
//         totalAmount: plan.price,
//         creditUsed: plan.price,
//         stripeAmount: 0,
//         upgradeCost: plan.price,
//         remainingValue: 0,
//       },
//       isUpgrade: validation.isUpgrade,
//       status: "completed",
//       completedAt: new Date(),
//       metadata: {
//         autoRenewal: autoRenewal,
//         paymentType: "credit_purchase",
//         upgradeInfo: validation.message,
//       },
//     });

//     // Save payment record
//     await payment.save();

//     // Update user plan
//     await User.findByIdAndUpdate(userId, {
//       plan: plan._id,
//     });

//     // Get updated credit balance
//     const newCreditBalance = Math.abs(
//       await getStripeCreditBalance(customer.id)
//     );

//     res.json({
//       success: true,
//       message: "Plan purchased successfully with Stripe credits",
//       credits: {
//         used: plan.price,
//         remaining: newCreditBalance,
//       },
//       transaction: {
//         paymentId: payment.paymentId,
//         method: "stripe_credits",
//         amount: plan.price,
//         planName: plan.name,
//         autoRenewal: autoRenewal,
//       },
//       upgrade: {
//         isUpgrade: validation.isUpgrade,
//         message: validation.message,
//       },
//     });
//   } catch (error) {
//     console.error("Error purchasing with credits:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to purchase plan",
//       error: error.message,
//     });
//   }
// };

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

    // Check if user has active subscription
    const activeSubInfo = await checkActiveSubscription(user);

    if (!activeSubInfo.hasActiveSubscription) {
      return res.status(400).json({
        success: false,
        message: "No active subscription found to modify",
      });
    }

    try {
      await stripe.subscriptions.update(activeSubInfo.subscriptionId, {
        cancel_at_period_end: !autoRenewal,
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

    const user = await User.findById(userId).select("stripeCustomerId");

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

    // Check for active subscription
    const activeSubInfo = await checkActiveSubscription(user);
    let subscriptionDetails = null;

    if (activeSubInfo.hasActiveSubscription) {
      try {
        const stripeData = await getUserStripeSubscriptionData(user);
        if (stripeData) {
          subscriptionDetails = {
            id: activeSubInfo.subscriptionId,
            status: stripeData.status,
            currentPeriodStart: stripeData.activatedAt,
            currentPeriodEnd: stripeData.expiresAt,
            cancelAtPeriodEnd: stripeData.cancelAtPeriodEnd,
            isTrialing: stripeData.isTrialing,
            trialStart: stripeData.trialStart,
            trialEnd: stripeData.trialEnd,
          };
        }
      } catch (error) {
        console.error("Error getting Stripe subscription:", error);
      }
    }

    // Get current plan from subscription
    const currentPlan = await getUserCurrentPlan(user);

    res.json({
      success: true,
      data: {
        plan: currentPlan,
        creditBalance: creditBalance,
        subscription: subscriptionDetails,
        stripeCustomerId: user.stripeCustomerId,
        hasActiveSubscription: activeSubInfo.hasActiveSubscription,
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

/**
 * Create checkout session for subscription purchase
 * @route POST /api/user/payment/create-checkout-session
 * @access Private
 */
const createCheckoutSession = async (req, res) => {
  try {
    const { planId, autoRenewal = true } = req.body;
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
        message: "Plan is not properly configured with Stripe",
      });
    }

    // Get user and current plan from subscription
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Get current plan from active subscription
    const currentPlan = await getUserCurrentPlan(user);
    console.log("Current plan:", currentPlan);

    // Check for active subscription
    const activeSubInfo = await checkActiveSubscription(user);
    console.log("Active subscription info:", activeSubInfo);

    // Validate plan upgrade/change
    const validation = validatePlanUpgrade(currentPlan, plan);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.message,
      });
    }

    // Get or create Stripe customer
    const customer = await getOrCreateStripeCustomer(user);

    // DON'T cancel existing subscription here - only after successful payment
    // This prevents losing the current subscription if user abandons checkout

    // Create Stripe Checkout Session for embedded form
    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded",
      customer: customer.id,
      line_items: [
        {
          price: plan.stripePriceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      return_url: `${
        process.env.FRONTEND_URL || "http://localhost:3000"
      }/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        userId: userId.toString(),
        planId: plan._id.toString(),
        autoRenewal: autoRenewal.toString(),
        upgradeFrom: currentPlan?._id?.toString() || "none",
        type: "plan_upgrade",
        hasExistingSubscription: activeSubInfo.hasActiveSubscription.toString(),
        existingSubscriptionId: activeSubInfo.subscriptionId || "none",
      },
    });

    console.log("Created checkout session:", {
      id: session.id,
      status: session.status,
      client_secret: session.client_secret ? "present" : "missing",
    });

    res.json({
      success: true,
      clientSecret: session.client_secret,
      sessionId: session.id,
      planDetails: {
        planId: plan._id,
        planName: plan.name,
        planPrice: plan.price,
        autoRenewal: autoRenewal,
      },
      upgrade: {
        isUpgrade: validation.isUpgrade,
        message: validation.message,
      },
    });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create checkout session",
      error: error.message,
    });
  }
};

/**
 * Complete subscription after successful checkout
 * @route POST /api/user/payment/complete-subscription
 * @access Private
 */
const completeSubscription = async (req, res) => {
  try {
    const { sessionId } = req.body;
    const userId = req.user._id;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required",
      });
    }

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "subscription.items.data.price"],
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Checkout session not found",
      });
    }

    if (session.payment_status !== "paid") {
      return res.status(400).json({
        success: false,
        message: "Payment not completed",
      });
    }

    // Verify this session belongs to the current user
    if (session.metadata.userId !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access to session",
      });
    }

    const { planId, hasExistingSubscription, existingSubscriptionId } =
      session.metadata;

    // Get plan and user
    const [plan, user] = await Promise.all([
      Plan.findById(planId),
      User.findById(userId),
    ]);

    if (!plan || !user) {
      return res.status(404).json({
        success: false,
        message: "Plan or user not found",
      });
    }

    // Handle subscription upgrade/creation based on whether user had existing subscription
    let finalSubscription = session.subscription;

    if (
      hasExistingSubscription === "true" &&
      existingSubscriptionId !== "none"
    ) {
      try {
        console.log(
          "User had existing subscription, upgrading with prorations..."
        );

        // Get the existing subscription
        const existingSubscription = await stripe.subscriptions.retrieve(
          existingSubscriptionId
        );

        if (existingSubscription && existingSubscription.status === "active") {
          // Upgrade the existing subscription with prorations
          const upgradedSubscription = await stripe.subscriptions.update(
            existingSubscriptionId,
            {
              items: [
                {
                  id: existingSubscription.items.data[0].id,
                  price: plan.stripePriceId,
                },
              ],
              proration_behavior: "create_prorations", // This will calculate prorations automatically
              metadata: {
                ...existingSubscription.metadata,
                upgradedAt: new Date().toISOString(),
                upgradedFrom: session.metadata.upgradeFrom,
                newPlanId: planId,
                newPlanName: plan.name,
              },
            }
          );

          // Cancel the new subscription created by checkout since we upgraded the existing one
          await stripe.subscriptions.cancel(session.subscription.id);

          finalSubscription = upgradedSubscription;
          console.log(
            "Successfully upgraded existing subscription:",
            existingSubscriptionId
          );
        } else {
          console.log(
            "Existing subscription not active, keeping new subscription"
          );
          // If existing subscription is not active, keep the new one
        }
      } catch (upgradeError) {
        console.error("Error upgrading existing subscription:", upgradeError);
        // If upgrade fails, keep the new subscription
        console.log("Keeping new subscription due to upgrade error");
      }
    } else {
      console.log("No existing subscription, keeping new subscription");
    }

    // Update user with new plan and subscription info
    await User.findByIdAndUpdate(userId, {
      plan: plan._id,
      stripeSubscriptionId: finalSubscription.id,
      hasUsedProTrial: plan.name === "Pro" ? true : user.hasUsedProTrial,
    });

    // Create payment record
    await Payment.create({
      userId: userId,
      planId: plan._id,
      amount: session.amount_total,
      currency: session.currency,
      status: "succeeded",
      stripePaymentId: session.payment_intent,
      stripeSubscriptionId: finalSubscription.id,
      metadata: {
        autoRenewal: session.metadata.autoRenewal === "true",
        paymentType:
          hasExistingSubscription === "true"
            ? "subscription_upgrade"
            : "subscription_purchase",
        sessionId: sessionId,
        upgradeFrom: session.metadata.upgradeFrom,
      },
    });

    console.log(`Successfully upgraded user ${userId} to plan ${plan.name}`);

    res.json({
      success: true,
      message: `Successfully upgraded to ${plan.name}!`,
      subscription: {
        id: finalSubscription.id,
        status: finalSubscription.status,
        currentPeriodStart: finalSubscription.current_period_start,
        currentPeriodEnd: finalSubscription.current_period_end,
      },
      plan: {
        id: plan._id,
        name: plan.name,
        price: plan.price,
      },
    });
  } catch (error) {
    console.error("Error completing subscription:", error);
    res.status(500).json({
      success: false,
      message: "Failed to complete subscription",
      error: error.message,
    });
  }
};

module.exports = {
  createSubscription,
  // purchaseWithCredits,
  toggleAutoRenewal,
  getPaymentStatus,
  createCheckoutSession,
  completeSubscription,
};
