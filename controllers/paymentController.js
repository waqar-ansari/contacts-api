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

module.exports = {
  createSubscription,
  // purchaseWithCredits,
  toggleAutoRenewal,
  getPaymentStatus,
};
