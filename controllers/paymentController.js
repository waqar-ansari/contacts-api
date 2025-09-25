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
 * Purchase plan using Stripe billing credits for initial subscriptions only
 * @route POST /api/user/payment/purchase-with-credits
 * @access Private
 */
const purchaseWithCredits = async (req, res) => {
  try {
    const { planId, autoRenewal = true } = req.body; // Default to false for credit purchases
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
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Get current plan from subscription
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

    // Prevent credit purchases if user has active subscription (should upgrade instead)
    if (activeSubInfo.hasActiveSubscription) {
      return res.status(400).json({
        success: false,
        message:
          "You have an active subscription. Please use the subscription upgrade flow instead of purchasing with credits.",
      });
    }

    // Get or create Stripe customer
    const customer = await getOrCreateStripeCustomer(user);

    // Check Stripe credit balance
    const availableCredits = Math.abs(
      await getStripeCreditBalance(customer.id)
    );

    const planPriceInDollars = plan.price / 100; // Convert from cents to dollars
    console.log("Available credits:", availableCredits, "price:", plan.price);
    if (availableCredits < plan.price) {
      return res.status(400).json({
        success: false,
        message: "Insufficient Stripe credits",
        required: planPriceInDollars,
        available: availableCredits / 100,
      });
    }

    // Create a Stripe subscription (similar to checkout session flow)
    // This ensures the user has an actual subscription in Stripe for future billing
    // For credit purchases, always disable auto-renewal to avoid billing issues
    const subscription = await createStripeSubscription(
      customer.id,
      plan.stripePriceId,
      {
        cancel_at_period_end: true, // Always true for credit purchases
        metadata: {
          userId: userId.toString(),
          planId: planId.toString(),
          planName: plan.name,
          autoRenewal: "false", // Force to false for credits
          paymentMethod: "stripe_credits",
        },
      }
    );

    console.log(
      `Successfully created subscription ${subscription.id} with credits for user ${userId}`
    );

    // Get updated credit balance
    const newCreditBalance = Math.abs(
      await getStripeCreditBalance(customer.id)
    );
    console.log("New credit balance:", newCreditBalance);

    console.log(
      `Successfully created subscription ${subscription.id} with credits for user ${userId}`
    );

    res.json({
      success: true,
      message: "Plan purchased successfully with Stripe credits",
      credits: {
        used: planPriceInDollars,
        remaining: newCreditBalance,
      },
      subscription: {
        id: subscription.id,
        status: subscription.status,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
      transaction: {
        method: "stripe_credits",
        amount: planPriceInDollars,
        planName: plan.name,
        autoRenewal: autoRenewal,
      },
      plan: {
        id: plan._id,
        name: plan.name,
        price: planPriceInDollars,
      },
      upgrade: {
        isUpgrade: validation.isUpgrade,
        message: validation.message,
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
 * Get user's Stripe credit balance
 * @route GET /api/user/payment/credit-balance
 * @access Private
 */
const getCreditBalance = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Get or create Stripe customer
    const customer = await getOrCreateStripeCustomer(user);

    // Get Stripe credit balance
    const creditBalance = Math.abs(await getStripeCreditBalance(customer.id));

    res.json({
      success: true,
      creditBalance: creditBalance,
      customerId: customer.id,
    });
  } catch (error) {
    console.error("Error getting credit balance:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get credit balance",
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
        message: "No active subscription found",
      });
    }

    // Get current subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(
      activeSubInfo.subscriptionId
    );

    // Check if subscription was paid with credits (these can't be auto-renewed)
    if (subscription.metadata?.paymentMethod === "stripe_credits") {
      return res.status(400).json({
        success: false,
        message:
          "Subscriptions paid with credits cannot be auto-renewed. Please purchase a new subscription when it expires.",
      });
    }

    // Toggle auto-renewal
    const newCancelAtPeriodEnd = !subscription.cancel_at_period_end;

    const updatedSubscription = await stripe.subscriptions.update(
      activeSubInfo.subscriptionId,
      {
        cancel_at_period_end: newCancelAtPeriodEnd,
      }
    );

    const message = newCancelAtPeriodEnd
      ? "Auto-renewal has been disabled. Your subscription will end at the current period."
      : "Auto-renewal has been enabled. Your subscription will continue automatically.";

    res.json({
      success: true,
      message: message,
      subscription: {
        cancelAtPeriodEnd: updatedSubscription.cancel_at_period_end,
        currentPeriodEnd: updatedSubscription.current_period_end,
      },
    });
  } catch (error) {
    console.error("Error toggling auto-renewal:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update auto-renewal settings",
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
          percentUsed: Math.round(
            ((totalPeriodTime - timeRemaining) / totalPeriodTime) * 100
          ),
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
    const { planId, autoRenewal = true, paymentMethodId } = req.body;
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

    // Update payment method if provided
    let updateData = {
      items: [
        {
          id: existingSubscription.items.data[0].id,
          price: plan.stripePriceId,
        },
      ],
      proration_behavior: "always_invoice", // Create invoice immediately for proration
      cancel_at_period_end: false,
      metadata: {
        ...existingSubscription.metadata,
        upgradedAt: new Date().toISOString(),
        upgradedFrom: currentPlan?._id?.toString() || "unknown",
        newPlanId: planId,
        newPlanName: plan.name,
      },
    };

    // Add payment method if provided
    if (paymentMethodId) {
      updateData.default_payment_method = paymentMethodId;
    }

    // Upgrade the subscription with immediate proration
    const upgradedSubscription = await stripe.subscriptions.update(
      activeSubInfo.subscriptionId,
      updateData
    );

    // Get the latest invoice for proration amount
    const latestInvoice = await stripe.invoices.retrieve(
      upgradedSubscription.latest_invoice
    );

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

/**
 * Get user's payment methods
 * @route GET /api/user/payment/payment-methods
 * @access Private
 */
const getPaymentMethods = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.stripeCustomerId) {
      return res.json({
        success: true,
        paymentMethods: [],
        defaultPaymentMethod: null,
      });
    }

    // Get payment methods from Stripe
    const paymentMethods = await stripe.paymentMethods.list({
      customer: user.stripeCustomerId,
      type: "card",
    });

    // Get customer to check default payment method
    const customer = await stripe.customers.retrieve(user.stripeCustomerId);

    const formattedPaymentMethods = paymentMethods.data.map((pm) => ({
      id: pm.id,
      type: pm.type,
      card: {
        brand: pm.card.brand,
        last4: pm.card.last4,
        exp_month: pm.card.exp_month,
        exp_year: pm.card.exp_year,
      },
      isDefault: pm.id === customer.invoice_settings?.default_payment_method,
    }));

    res.json({
      success: true,
      paymentMethods: formattedPaymentMethods,
      defaultPaymentMethod: customer.invoice_settings?.default_payment_method,
    });
  } catch (error) {
    console.error("Error getting payment methods:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get payment methods",
      error: error.message,
    });
  }
};

/**
 * Add new payment method
 * @route POST /api/user/payment/add-payment-method
 * @access Private
 */
const addPaymentMethod = async (req, res) => {
  try {
    const { paymentMethodId, setAsDefault = false } = req.body;
    const userId = req.user._id;

    if (!paymentMethodId) {
      return res.status(400).json({
        success: false,
        message: "Payment method ID is required",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Get or create Stripe customer
    const customer = await getOrCreateStripeCustomer(user);

    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customer.id,
    });

    // Set as default if requested or if it's the first payment method
    if (setAsDefault) {
      await stripe.customers.update(customer.id, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
    }

    // Get the updated payment method details
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

    res.json({
      success: true,
      message: "Payment method added successfully",
      paymentMethod: {
        id: paymentMethod.id,
        type: paymentMethod.type,
        card: {
          brand: paymentMethod.card.brand,
          last4: paymentMethod.card.last4,
          exp_month: paymentMethod.card.exp_month,
          exp_year: paymentMethod.card.exp_year,
        },
        isDefault: setAsDefault,
      },
    });
  } catch (error) {
    console.error("Error adding payment method:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add payment method",
      error: error.message,
    });
  }
};

/**
 * Set default payment method
 * @route POST /api/user/payment/set-default-payment-method
 * @access Private
 */
const setDefaultPaymentMethod = async (req, res) => {
  try {
    const { paymentMethodId } = req.body;
    const userId = req.user._id;

    if (!paymentMethodId) {
      return res.status(400).json({
        success: false,
        message: "Payment method ID is required",
      });
    }

    const user = await User.findById(userId);
    if (!user || !user.stripeCustomerId) {
      return res.status(404).json({
        success: false,
        message: "User or Stripe customer not found",
      });
    }

    // Update customer's default payment method
    await stripe.customers.update(user.stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    res.json({
      success: true,
      message: "Default payment method updated successfully",
    });
  } catch (error) {
    console.error("Error setting default payment method:", error);
    res.status(500).json({
      success: false,
      message: "Failed to set default payment method",
      error: error.message,
    });
  }
};

/**
 * Update payment method (mainly for updating billing details)
 * @route PUT /api/user/payment/update-payment-method
 * @access Private
 */
const updatePaymentMethod = async (req, res) => {
  try {
    const { paymentMethodId, billingDetails } = req.body;
    const userId = req.user._id;

    if (!paymentMethodId) {
      return res.status(400).json({
        success: false,
        message: "Payment method ID is required",
      });
    }

    const user = await User.findById(userId);
    if (!user || !user.stripeCustomerId) {
      return res.status(404).json({
        success: false,
        message: "User or Stripe customer not found",
      });
    }

    // Verify that the payment method belongs to this customer
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (paymentMethod.customer !== user.stripeCustomerId) {
      return res.status(403).json({
        success: false,
        message: "Payment method does not belong to this user",
      });
    }

    // Update payment method billing details
    let updateData = {};
    if (billingDetails) {
      updateData.billing_details = billingDetails;
    }

    const updatedPaymentMethod = await stripe.paymentMethods.update(
      paymentMethodId,
      updateData
    );

    res.json({
      success: true,
      message: "Payment method updated successfully",
      paymentMethod: {
        id: updatedPaymentMethod.id,
        type: updatedPaymentMethod.type,
        card: {
          brand: updatedPaymentMethod.card.brand,
          last4: updatedPaymentMethod.card.last4,
          exp_month: updatedPaymentMethod.card.exp_month,
          exp_year: updatedPaymentMethod.card.exp_year,
        },
        billing_details: updatedPaymentMethod.billing_details,
      },
    });
  } catch (error) {
    console.error("Error updating payment method:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update payment method",
      error: error.message,
    });
  }
};

/**
 * Delete payment method
 * @route DELETE /api/user/payment/delete-payment-method/:paymentMethodId
 * @access Private
 */
const deletePaymentMethod = async (req, res) => {
  try {
    const { paymentMethodId } = req.params;
    const userId = req.user._id;

    if (!paymentMethodId) {
      return res.status(400).json({
        success: false,
        message: "Payment method ID is required",
      });
    }

    const user = await User.findById(userId);
    if (!user || !user.stripeCustomerId) {
      return res.status(404).json({
        success: false,
        message: "User or Stripe customer not found",
      });
    }

    // Verify that the payment method belongs to this customer
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (paymentMethod.customer !== user.stripeCustomerId) {
      return res.status(403).json({
        success: false,
        message: "Payment method does not belong to this user",
      });
    }

    // Check if this is the default payment method
    const customer = await stripe.customers.retrieve(user.stripeCustomerId);
    const isDefaultPaymentMethod =
      customer.invoice_settings?.default_payment_method === paymentMethodId;

    if (isDefaultPaymentMethod) {
      // Get all payment methods to check if there are others
      const paymentMethods = await stripe.paymentMethods.list({
        customer: user.stripeCustomerId,
        type: "card",
      });

      // If there are other payment methods, set one as default
      if (paymentMethods.data.length > 1) {
        const otherPaymentMethod = paymentMethods.data.find(
          (pm) => pm.id !== paymentMethodId
        );
        if (otherPaymentMethod) {
          await stripe.customers.update(user.stripeCustomerId, {
            invoice_settings: {
              default_payment_method: otherPaymentMethod.id,
            },
          });
        }
      } else {
        // This is the last payment method, clear the default
        await stripe.customers.update(user.stripeCustomerId, {
          invoice_settings: {
            default_payment_method: null,
          },
        });
      }
    }

    // Detach the payment method from the customer
    await stripe.paymentMethods.detach(paymentMethodId);

    res.json({
      success: true,
      message: "Payment method deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting payment method:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete payment method",
      error: error.message,
    });
  }
};

module.exports = {
  createSubscription,
  purchaseWithCredits,
  getCreditBalance,
  toggleAutoRenewal,
  getPaymentStatus,
  createCheckoutSession,
  completeSubscription,
  upgradeSubscription,
  previewUpgrade,
  getPaymentMethods,
  addPaymentMethod,
  setDefaultPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
};
