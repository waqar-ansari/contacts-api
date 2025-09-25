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
    // This is a downgrade - allow but schedule for period end
    validation.isDowngrade = true;
    validation.message = `Downgrading from ${currentPlan.name} to ${newPlan.name}. Change will take effect at the end of current billing period.`;
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
 * Preview upgrade cost and proration details before actual upgrade using Stripe's Upcoming Invoice API
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

    // Get the existing subscription
    const existingSubscription = await stripe.subscriptions.retrieve(
      activeSubInfo.subscriptionId,
      {
        expand: ["items.data.price"],
      }
    );

    if (!existingSubscription || existingSubscription.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Current subscription is not active",
      });
    }

    console.log("Subscription data:", {
      id: existingSubscription.id,
      status: existingSubscription.status,
      current_period_start:
        existingSubscription.items.data[0].current_period_start,
      current_period_end: existingSubscription.items.data[0].current_period_end,
      items: existingSubscription.items?.data?.length || 0,
    });

    // Use Stripe's Upcoming Invoice Preview API for accurate calculation
    // This simulates what would happen if we change the subscription
    const subscriptionItem = existingSubscription.items.data[0];

    try {
      // Preview the upcoming invoice with the subscription change
      const upcomingInvoice = await stripe.invoices.createPreview({
        customer: user.stripeCustomerId,
        subscription: activeSubInfo.subscriptionId,
        subscription_details: {
          items: [
            {
              id: subscriptionItem.id,
              price: plan.stripePriceId, // Change to new price
            },
          ],
          proration_behavior: "create_prorations", // Enable proration
        },
      });

      console.log("Stripe upcoming invoice preview:", {
        amount_due: upcomingInvoice.amount_due,
        amount_paid: upcomingInvoice.amount_paid,
        amount_remaining: upcomingInvoice.amount_remaining,
        subtotal: upcomingInvoice.subtotal,
        total: upcomingInvoice.total,
        lines_count: upcomingInvoice.lines?.data?.length || 0,
      });

      // Parse the invoice line items to understand the charges
      const invoiceLines = upcomingInvoice.lines.data;

      // Find proration credit (negative amount) and new charge (positive amount)
      let prorationCredit = 0;
      let newPlanCharge = 0;
      let immediateCharge = 0;

      // Get current period end to filter out future billing cycles
      let currentBillingPeriodEnd =
        existingSubscription.items.data[0].current_period_end;
      if (!currentBillingPeriodEnd && invoiceLines.length > 0) {
        const lineWithPeriod = invoiceLines.find((line) => line.period);
        if (lineWithPeriod) {
          currentBillingPeriodEnd = lineWithPeriod.period.end;
        }
      }

      invoiceLines.forEach((line, index) => {
        console.log(`Invoice line ${index + 1}:`, {
          description: line.description,
          amount: line.amount,
          amount_in_dollars: (line.amount / 100).toFixed(2),
          proration: line.proration,
          period: line.period
            ? {
                start: new Date(line.period.start * 1000).toISOString(),
                end: new Date(line.period.end * 1000).toISOString(),
              }
            : null,
          isCurrentPeriod: line.period
            ? line.period.end <= currentBillingPeriodEnd
            : "unknown",
        });

        // Only include charges from the current billing period (exclude future billing cycles)
        const isCurrentPeriodCharge =
          !line.period || line.period.end <= currentBillingPeriodEnd;

        if (line.amount < 0) {
          // This is a proration credit for unused time (negative amount)
          prorationCredit += Math.abs(line.amount);
          console.log(
            `  -> Adding credit: $${(Math.abs(line.amount) / 100).toFixed(2)}`
          );
        } else if (line.amount > 0 && isCurrentPeriodCharge) {
          // Only include positive charges from current period (exclude next month's full charge)
          newPlanCharge += line.amount;
          console.log(
            `  -> Adding current period charge: $${(line.amount / 100).toFixed(
              2
            )}`
          );
        } else if (line.amount > 0 && !isCurrentPeriodCharge) {
          console.log(
            `  -> Skipping future period charge: $${(line.amount / 100).toFixed(
              2
            )} (next billing cycle)`
          );
        }
      });

      // Calculate the actual immediate charge for current period only
      immediateCharge = Math.max(0, newPlanCharge - prorationCredit);

      console.log("Proration summary:", {
        totalCredit: (prorationCredit / 100).toFixed(2),
        totalCurrentPeriodCharge: (newPlanCharge / 100).toFixed(2),
        calculatedImmediateCharge: (immediateCharge / 100).toFixed(2),
        stripeRawAmountDue: (upcomingInvoice.amount_due / 100).toFixed(2),
      });

      // Get current plan details
      const currentPrice = existingSubscription.items.data[0].price;
      const currentAmount = currentPrice.unit_amount / 100; // Convert to dollars
      const newAmount = plan.price / 100; // Convert to dollars

      // Calculate period information from invoice lines (more reliable)
      const now = Math.floor(Date.now() / 1000);
      let currentPeriodEnd =
        existingSubscription.items.data[0].current_period_end;
      let currentPeriodStart =
        existingSubscription.items.data[0].current_period_start;

      // If subscription periods are undefined, get from invoice line periods
      if (!currentPeriodEnd && invoiceLines.length > 0) {
        const lineWithPeriod = invoiceLines.find((line) => line.period);
        if (lineWithPeriod) {
          currentPeriodEnd = lineWithPeriod.period.end;
          currentPeriodStart = lineWithPeriod.period.start;
        }
      }

      const timeRemaining = Math.max(0, currentPeriodEnd - now);
      const totalPeriodTime = currentPeriodEnd - currentPeriodStart;

      // Safe date conversion with validation
      let nextBillingDate;
      try {
        nextBillingDate =
          currentPeriodEnd && !isNaN(currentPeriodEnd)
            ? new Date(currentPeriodEnd * 1000).toISOString()
            : new Date().toISOString(); // Fallback to current date
      } catch (error) {
        console.error("Date conversion error:", error);
        nextBillingDate = new Date().toISOString(); // Fallback
      }

      // Get Stripe credit balance for the user
      const availableCredits = Math.abs(
        await getStripeCreditBalance(user.stripeCustomerId)
      );
      console.log("Available Stripe credits:", availableCredits);

      // Calculate how much credits will be used (up to the immediate charge amount)
      const creditsToUse = Math.min(availableCredits, immediateCharge);
      const finalChargeAfterCredits = Math.max(
        0,
        immediateCharge - creditsToUse
      );
      const remainingCreditsAfterPurchase = availableCredits - creditsToUse;

      console.log("Credit calculation:", {
        availableCredits: availableCredits / 100,
        immediateCharge: immediateCharge / 100,
        creditsToUse: creditsToUse / 100,
        finalChargeAfterCredits: finalChargeAfterCredits / 100,
        remainingCreditsAfterPurchase: remainingCreditsAfterPurchase / 100,
      });

      console.log("Processed preview data:", {
        currentAmount,
        newAmount,
        prorationCredit: prorationCredit / 100,
        immediateCharge: immediateCharge / 100,
        nextBillingDate,
        periodInfo: {
          currentPeriodStart,
          currentPeriodEnd,
          timeRemaining: `${Math.ceil(timeRemaining / (24 * 60 * 60))} days`,
        },
      });

      res.json({
        success: true,
        message: "Upgrade preview calculated successfully using Stripe",
        preview: {
          currentPlan: {
            id: currentPlan?._id,
            name: currentPlan?.name,
            price: currentAmount,
            remainingValue: prorationCredit / 100, // Convert to dollars
          },
          newPlan: {
            id: plan._id,
            name: plan.name,
            price: newAmount,
            proRatedAmount: newAmount,
          },
          billing: {
            immediateCharge: immediateCharge / 100, // Convert to dollars
            creditApplied: prorationCredit / 100, // Convert to dollars
            netAmount: immediateCharge / 100, // Convert to dollars
            nextBillingDate: nextBillingDate,
            nextBillingAmount: newAmount,
          },
          credits: {
            availableCredits: availableCredits / 100, // Convert to dollars
            creditsToUse: creditsToUse / 100, // Convert to dollars
            finalChargeAfterCredits: finalChargeAfterCredits / 100, // Convert to dollars
            remainingCreditsAfterPurchase: remainingCreditsAfterPurchase / 100, // Convert to dollars
          },
          period: {
            daysRemaining: Math.max(
              1,
              Math.ceil(timeRemaining / (24 * 60 * 60))
            ),
            percentUsed: Math.round(
              ((totalPeriodTime - timeRemaining) / totalPeriodTime) * 100
            ),
          },
          stripeInvoicePreview: {
            invoiceId: upcomingInvoice.id,
            amountDue: upcomingInvoice.amount_due / 100,
            subtotal: upcomingInvoice.subtotal / 100,
            total: upcomingInvoice.total / 100,
            currency: upcomingInvoice.currency,
          },
        },
      });
    } catch (stripeError) {
      console.error("Stripe upcoming invoice error:", stripeError);

      // Fallback to basic calculation if Stripe preview fails
      const currentPrice = existingSubscription.items.data[0].price;
      const currentAmount = currentPrice.unit_amount / 100;
      const newAmount = plan.price / 100;

      return res.status(500).json({
        success: false,
        message:
          "Unable to preview upgrade costs using Stripe. Please try again.",
        error: stripeError.message,
        fallback: {
          currentPlanPrice: currentAmount,
          newPlanPrice: newAmount,
          estimatedChange: newAmount - currentAmount,
        },
      });
    }
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

/**
 * Handle plan downgrade by scheduling the change at period end
 * @route POST /api/user/payment/downgrade-subscription
 * @access Private
 */
const downgradeSubscription = async (req, res) => {
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

    if (!activeSubInfo.hasActiveSubscription) {
      return res.status(400).json({
        success: false,
        message: "No active subscription found.",
      });
    }

    // Validate plan change
    const validation = validatePlanUpgrade(currentPlan, plan);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.message,
      });
    }

    if (!validation.isDowngrade) {
      return res.status(400).json({
        success: false,
        message: "This is not a downgrade. Use the upgrade endpoint instead.",
      });
    }

    // Get the existing subscription
    const existingSubscription = await stripe.subscriptions.retrieve(
      activeSubInfo.subscriptionId
    );
    console.log("Existing subscription:", existingSubscription);
    if (!existingSubscription || existingSubscription.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Current subscription is not active",
      });
    }

    // Check if there's already a scheduled downgrade and cancel it
    if (existingSubscription.metadata?.scheduledDowngradeId) {
      try {
        await stripe.subscriptionSchedules.cancel(
          existingSubscription.metadata.scheduledDowngradeId
        );
        console.log(
          `Cancelled previous downgrade schedule: ${existingSubscription.metadata.scheduledDowngradeId}`
        );
      } catch (cancelError) {
        console.log(
          "Previous schedule already cancelled or not found:",
          cancelError.message
        );
      }
    }

    // Schedule the downgrade to take effect at period end
    // We use subscription schedules for this - create from scratch instead of from_subscription
    try {
      const subscriptionSchedule = await stripe.subscriptionSchedules.create({
        customer: user.stripeCustomerId,
        start_date: existingSubscription.items.data[0].current_period_end,
        end_behavior: "release",
        phases: [
          {
            items: [
              {
                price: plan.stripePriceId,
                quantity: 1,
              },
            ],
            metadata: {
              userId: userId.toString(),
              planId: planId.toString(),
              planName: plan.name,
              downgradedFrom: currentPlan?._id?.toString() || "unknown",
              downgradedAt: new Date().toISOString(),
            },
          },
        ],
      });

      // Cancel the current subscription at period end
      await stripe.subscriptions.update(activeSubInfo.subscriptionId, {
        cancel_at_period_end: true,
        metadata: {
          ...existingSubscription.metadata,
          scheduledDowngradeId: subscriptionSchedule.id,
          downgradeTo: plan.name,
          downgradeScheduledAt: new Date().toISOString(),
        },
      });

      console.log(
        `Successfully scheduled downgrade for user ${userId} from ${
          currentPlan?.name || "unknown"
        } to ${plan.name} at period end`
      );

      res.json({
        success: true,
        message: `Successfully scheduled downgrade to ${
          plan.name
        }. The change will take effect on ${new Date(
          existingSubscription.items.data[0].current_period_end * 1000
        ).toLocaleDateString()}.`,
        downgrade: {
          scheduleId: subscriptionSchedule.id,
          currentPlan: {
            id: currentPlan?._id,
            name: currentPlan?.name,
          },
          newPlan: {
            id: plan._id,
            name: plan.name,
          },
          effectiveDate: existingSubscription.items.data[0].current_period_end,
          currentPeriodEnd:
            existingSubscription.items.data[0].current_period_end,
          cancelAtPeriodEnd: true,
        },
      });
    } catch (scheduleError) {
      console.error("Error creating subscription schedule:", scheduleError);
      res.status(500).json({
        success: false,
        message: "Failed to schedule downgrade",
        error: scheduleError.message,
      });
    }
  } catch (error) {
    console.error("Error processing downgrade:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process downgrade",
      error: error.message,
    });
  }
};

module.exports = {
  purchaseWithCredits,
  getCreditBalance,
  toggleAutoRenewal,
  getPaymentStatus,
  createCheckoutSession,
  completeSubscription,
  upgradeSubscription,
  previewUpgrade,
  downgradeSubscription,
  getPaymentMethods,
  addPaymentMethod,
  setDefaultPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
};
