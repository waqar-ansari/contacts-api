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
 * Preview upgrade cost and proration details before actual upgrade
 * @route POST /api/user/payment/preview-upgrade
 * @access Private
 */
const previewUpgrade = async (req, res) => {
  try {
    const { planId } = req.body;
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

    if (!activeSubInfo.hasActiveSubscription) {
      return res.status(400).json({
        success: false,
        message: "No active subscription found. Cannot preview upgrade.",
      });
    }

    // Validate plan upgrade/change
    const validation = validatePlanUpgrade(currentPlan, plan);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.message,
      });
    }

    // Get the existing subscription to preview the upgrade
    const existingSubscription = await stripe.subscriptions.retrieve(
      activeSubInfo.subscriptionId,
      {
        expand: ["items.data.price"],
      }
    );

    // Debug subscription data
    console.log("Subscription data:", {
      id: existingSubscription.id,
      status: existingSubscription.status,
      current_period_start: existingSubscription.current_period_start,
      current_period_end: existingSubscription.current_period_end,
      items: existingSubscription.items?.data?.length || 0,
      billing_cycle_anchor: existingSubscription.billing_cycle_anchor,
      created: existingSubscription.created,
    });

    if (!existingSubscription || existingSubscription.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Current subscription is not active",
      });
    }

    // Create a preview of the subscription upgrade to get proration details
    const currentPrice = existingSubscription.items.data[0].price;
    let currentPeriodEnd = existingSubscription.current_period_end;
    let currentPeriodStart = existingSubscription.current_period_start;

    console.log("Current price data:", {
      unit_amount: currentPrice?.unit_amount,
      currency: currentPrice?.currency,
    });

    // Validate price data
    if (!currentPrice || !currentPrice.unit_amount) {
      return res.status(400).json({
        success: false,
        message: "Unable to retrieve current subscription pricing",
      });
    }

    // Fallback for missing period data - use billing cycle or create estimates
    if (!currentPeriodEnd || !currentPeriodStart) {
      console.log("Missing period data, using fallbacks");
      const now = Math.floor(Date.now() / 1000);

      if (existingSubscription.billing_cycle_anchor) {
        currentPeriodStart = existingSubscription.billing_cycle_anchor;
        // Assume monthly billing (30 days)
        currentPeriodEnd = currentPeriodStart + 30 * 24 * 60 * 60;
      } else {
        // Use created date as start and estimate end
        currentPeriodStart = existingSubscription.created;
        currentPeriodEnd = currentPeriodStart + 30 * 24 * 60 * 60;
      }

      // If the estimated end is in the past, move it to the future
      while (currentPeriodEnd <= now) {
        currentPeriodStart = currentPeriodEnd;
        currentPeriodEnd = currentPeriodStart + 30 * 24 * 60 * 60;
      }
    }

    // Calculate proration manually
    const now = Math.floor(Date.now() / 1000);
    const timeRemaining = Math.max(0, currentPeriodEnd - now);
    const totalPeriodTime = currentPeriodEnd - currentPeriodStart;
    const prorationFactor =
      totalPeriodTime > 0 ? timeRemaining / totalPeriodTime : 0;

    // Get current and new plan amounts
    const currentAmount = currentPrice.unit_amount / 100; // Convert from cents
    const newAmount = plan.price / 100; // Convert from cents to dollars

    // Calculate proration credit and new charge
    const prorationCredit = currentAmount * prorationFactor;
    const immediateCharge = newAmount - prorationCredit;

    // Create next billing date safely
    let nextBillingDate;
    try {
      nextBillingDate = new Date(currentPeriodEnd * 1000).toISOString();
    } catch (error) {
      console.error("Invalid date for currentPeriodEnd:", currentPeriodEnd);
      // Fallback to 30 days from now
      nextBillingDate = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ).toISOString();
    }

    const previewData = {
      current_plan_amount: Number(currentAmount) || 0,
      new_plan_amount: Number(newAmount) || 0,
      proration_credit: Number(Math.max(0, prorationCredit)) || 0,
      immediate_charge: Number(Math.max(0, immediateCharge)) || 0,
      next_billing_date: nextBillingDate,
    };

    console.log("Preview data:", previewData);

    console.log(
      `Preview upgrade from ${currentPlan?.name || "unknown"} to ${plan.name}`
    );

    res.json({
      success: true,
      message: "Upgrade preview calculated successfully",
      preview: {
        currentPlan: {
          id: currentPlan?._id,
          name: currentPlan?.name,
          price: previewData.current_plan_amount || 0,
          remainingValue: previewData.proration_credit || 0,
        },
        newPlan: {
          id: plan._id,
          name: plan.name,
          price: previewData.new_plan_amount || 0,
          proRatedAmount: previewData.new_plan_amount || 0,
        },
        billing: {
          immediateCharge: previewData.immediate_charge || 0,
          creditApplied: previewData.proration_credit || 0,
          netAmount: previewData.immediate_charge || 0,
          nextBillingDate: previewData.next_billing_date,
          nextBillingAmount: previewData.new_plan_amount || 0,
        },
        period: {
          daysRemaining: Math.max(1, Math.ceil(timeRemaining / (24 * 60 * 60))),
          percentUsed: Math.round(((totalPeriodTime - timeRemaining) / totalPeriodTime) * 100),
        },
      },
    });
  } catch (error) {
    console.error("Error previewing upgrade:", error);
    res.status(500).json({
      success: false,
      message: "Failed to preview upgrade",
      error: error.message,
    });
  }
};

/**
 * Handle plan upgrade for existing subscribers with direct subscription modification
 * @route POST /api/user/payment/upgrade-subscription
 * @access Private
 */
const upgradeSubscription = async (req, res) => {
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

    if (!activeSubInfo.hasActiveSubscription) {
      return res.status(400).json({
        success: false,
        message:
          "No active subscription found. Please create a new subscription.",
        redirectToCheckout: true,
      });
    }

    // Validate plan upgrade/change
    const validation = validatePlanUpgrade(currentPlan, plan);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.message,
      });
    }

    // Get the existing subscription
    const existingSubscription = await stripe.subscriptions.retrieve(
      activeSubInfo.subscriptionId
    );

    if (!existingSubscription || existingSubscription.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Current subscription is not active",
      });
    }

    // Upgrade the subscription with immediate proration
    const upgradedSubscription = await stripe.subscriptions.update(
      activeSubInfo.subscriptionId,
      {
        items: [
          {
            id: existingSubscription.items.data[0].id,
            price: plan.stripePriceId,
          },
        ],
        proration_behavior: "always_invoice", // Create invoice immediately for proration
        metadata: {
          ...existingSubscription.metadata,
          upgradedAt: new Date().toISOString(),
          upgradedFrom: currentPlan?._id?.toString() || "unknown",
          newPlanId: planId,
          newPlanName: plan.name,
        },
      }
    );

    // Update user with new plan
    await User.findByIdAndUpdate(userId, {
      plan: plan._id,
      stripeSubscriptionId: upgradedSubscription.id,
      hasUsedProTrial: plan.name === "Pro" ? true : user.hasUsedProTrial,
    });

    // Get the latest invoice for proration amount
    const latestInvoice = await stripe.invoices.retrieve(
      upgradedSubscription.latest_invoice
    );

    // Create payment record for the upgrade
    // await Payment.create({
    //   userId: userId,
    //   planId: plan._id,
    //   paymentMethod: "stripe",
    //   amounts: {
    //     totalAmount: latestInvoice.amount_paid, // Amount in cents
    //     creditUsed: 0,
    //     stripeAmount: latestInvoice.amount_paid,
    //     upgradeCost: latestInvoice.amount_paid,
    //     remainingValue: 0,
    //   },
    //   stripe: {
    //     paymentIntentId: latestInvoice.payment_intent,
    //     paymentStatus: "succeeded",
    //     transactionId: latestInvoice.id,
    //   },
    //   isUpgrade: true,
    //   isRenewal: false,
    //   isAutoRenewal: autoRenewal,
    //   previousPlan: {
    //     planId: currentPlan?._id || null,
    //   },
    //   newPlan: {
    //     activatedAt: new Date(upgradedSubscription.current_period_start * 1000),
    //     expiresAt: new Date(upgradedSubscription.current_period_end * 1000),
    //     autoRenewal: autoRenewal,
    //   },
    //   status: "completed",
    //   processedAt: new Date(),
    //   completedAt: new Date(),
    //   metadata: {
    //     currency: latestInvoice.currency.toUpperCase(),
    //     notes: `Subscription upgrade from ${
    //       currentPlan?.name || "unknown"
    //     } to ${plan.name}`,
    //   },
    // });

    console.log(
      `Successfully upgraded user ${userId} from ${
        currentPlan?.name || "unknown"
      } to ${plan.name}`
    );

    res.json({
      success: true,
      message: `Successfully upgraded to ${plan.name}!`,
      subscription: {
        id: upgradedSubscription.id,
        status: upgradedSubscription.status,
        currentPeriodStart: upgradedSubscription.current_period_start,
        currentPeriodEnd: upgradedSubscription.current_period_end,
      },
      plan: {
        id: plan._id,
        name: plan.name,
        price: plan.price,
      },
      billing: {
        prorationAmount: latestInvoice.amount_paid / 100, // Convert to dollars
        nextInvoiceDate: upgradedSubscription.current_period_end,
      },
    });
  } catch (error) {
    console.error("Error upgrading subscription:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upgrade subscription",
      error: error.message,
    });
  }
};

/**
 * Create checkout session for NEW subscription purchase only
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

    // Check for active subscription - redirect to upgrade endpoint if exists
    const activeSubInfo = await checkActiveSubscription(user);
    if (activeSubInfo.hasActiveSubscription) {
      return res.status(400).json({
        success: false,
        message:
          "You already have an active subscription. Use the upgrade endpoint instead.",
        redirectToUpgrade: true,
      });
    }

    // Get or create Stripe customer
    const customer = await getOrCreateStripeCustomer(user);

    // Create Stripe Checkout Session for embedded form (NEW SUBSCRIPTIONS ONLY)
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
        type: "new_subscription",
      },
    });

    console.log("Created checkout session for new subscription:", {
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
      isNewSubscription: true,
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
 * Complete subscription after successful Stripe checkout (NEW SUBSCRIPTIONS ONLY)
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

    // Verify this is for a new subscription (not upgrade)
    if (session.metadata.type !== "new_subscription") {
      return res.status(400).json({
        success: false,
        message:
          "This endpoint is only for new subscriptions. Use upgrade endpoint for existing subscriptions.",
      });
    }

    const { planId } = session.metadata;

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

    // // Update user with new plan and subscription info
    // await User.findByIdAndUpdate(userId, {
    //   plan: plan._id,
    //   stripeSubscriptionId: session.subscription.id,
    //   hasUsedProTrial: plan.name === "Pro" ? true : user.hasUsedProTrial,
    // });

    // // Create payment record
    // await Payment.create({
    //   userId: userId,
    //   planId: plan._id,
    //   paymentMethod: "stripe",
    //   amounts: {
    //     totalAmount: session.amount_total, // Amount in cents
    //     creditUsed: 0,
    //     stripeAmount: session.amount_total,
    //     upgradeCost: session.amount_total,
    //     remainingValue: 0,
    //   },
    //   stripe: {
    //     paymentIntentId: session.payment_intent,
    //     paymentStatus: "succeeded",
    //     transactionId: session.id,
    //   },
    //   isUpgrade: false,
    //   isRenewal: false,
    //   isAutoRenewal: session.metadata.autoRenewal === "true",
    //   newPlan: {
    //     activatedAt: new Date(session.subscription.current_period_start * 1000),
    //     expiresAt: new Date(session.subscription.current_period_end * 1000),
    //     autoRenewal: session.metadata.autoRenewal === "true",
    //   },
    //   status: "completed",
    //   processedAt: new Date(),
    //   completedAt: new Date(),
    //   metadata: {
    //     currency: session.currency.toUpperCase(),
    //     notes: `New subscription to ${plan.name}`,
    //   },
    // });

    console.log(
      `Successfully created new subscription for user ${userId} with plan ${plan.name}`
    );

    res.json({
      success: true,
      message: `Successfully subscribed to ${plan.name}!`,
      subscription: {
        id: session.subscription.id,
        status: session.subscription.status,
        currentPeriodStart: session.subscription.current_period_start,
        currentPeriodEnd: session.subscription.current_period_end,
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
  upgradeSubscription,
  previewUpgrade,
};
