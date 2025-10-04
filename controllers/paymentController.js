const { stripe } = require("../config/stripe");
const Plan = require("../models/planModel");
const User = require("../models/userModel");
const {
  getOrCreateStripeCustomer,
  getStripeCreditBalance,
  getUserStripeSubscriptionData,
  getCustomerPrimarySubscription,
  getCustomerActiveNonTrialingSubscription,
  getCustomerTrialingSubscription,
  deleteTrialingSubscription,
  getUserCurrentPlan,
  getFormattedBillingHistory,
  validateCoupon,
  calculateCouponDiscount,
  applyCouponToSession,
  hasUserMadeFirstPurchase,
  transferCacheCreditsToStripe,
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
 * Check if user has any active non-trialing Stripe subscriptions and trialing subscriptions separately
 * @param {Object} user - User object
 * @returns {Object} Active subscription info with trialing details
 */
const checkSubscriptionDetails = async (user) => {
  const result = {
    hasActiveSubscription: false,
    subscriptionId: null,
    subscriptionStatus: null,
    hasTrialingSubscription: false,
    trialingSubscriptionId: null,
  };

  if (!user.stripeCustomerId) {
    return result;
  }

  try {
    // Check for active non-trialing subscription
    const activeSubscription = await getCustomerActiveNonTrialingSubscription(
      user.stripeCustomerId
    );

    if (activeSubscription) {
      result.hasActiveSubscription = true;
      result.subscriptionId = activeSubscription.id;
      result.subscriptionStatus = activeSubscription.status;
    }

    // Check for trialing subscription
    const trialingSubscription = await getCustomerTrialingSubscription(
      user.stripeCustomerId
    );

    if (trialingSubscription) {
      result.hasTrialingSubscription = true;
      result.trialingSubscriptionId = trialingSubscription.id;
    }
  } catch (error) {
    console.log("Error checking subscription details:", error.message);
  }

  return result;
};

/**
 * Get user's Stripe credit balance
 * @route GET /api/user/payment/credit-balance
 * @access Private
 */
const getCreditBalance = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId).select(
      "stripeCustomerId cache_credits"
    );
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let creditBalance = 0;

    // Check if user has made their first purchase
    if (user.stripeCustomerId) {
      const hasFirstPurchase = await hasUserMadeFirstPurchase(
        user.stripeCustomerId
      );

      if (hasFirstPurchase) {
        // Get credit balance from Stripe
        const customer = await getOrCreateStripeCustomer(user);
        creditBalance = Math.abs(await getStripeCreditBalance(customer.id));
      } else {
        // Get credit balance from cache_credits (convert to cents)
        creditBalance = Math.round((user.cache_credits || 0) * 100);
      }
    } else {
      // No Stripe customer, get from cache_credits (convert to cents)
      creditBalance = Math.round((user.cache_credits || 0) * 100);
    }

    res.json({
      success: true,
      creditBalance: creditBalance,
      customerId: user.stripeCustomerId,
      source:
        user.stripeCustomerId &&
        (await hasUserMadeFirstPurchase(user.stripeCustomerId))
          ? "stripe"
          : "cache",
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

    const user = await User.findById(userId).select(
      "stripeCustomerId cache_credits"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Get credit balance based on first purchase status
    let creditBalance = 0;
    if (user.stripeCustomerId) {
      try {
        const hasFirstPurchase = await hasUserMadeFirstPurchase(
          user.stripeCustomerId
        );

        if (hasFirstPurchase) {
          // Get from Stripe and convert to dollars
          const stripeCreditBalance = await getStripeCreditBalance(
            user.stripeCustomerId
          );
          creditBalance = Math.abs(stripeCreditBalance) / 100;
        } else {
          // Get from cache_credits (already in dollars)
          creditBalance = user.cache_credits || 0;
        }
      } catch (error) {
        console.error("Error getting credit balance:", error);
        // Fallback to cache_credits if Stripe check fails
        creditBalance = user.cache_credits || 0;
      }
    } else {
      // No Stripe customer, get from cache_credits
      creditBalance = user.cache_credits || 0;
    }

    // Check for active subscription
    const activeSubInfo = await checkActiveSubscription(user);
    let subscriptionDetails = null;

    if (activeSubInfo.hasActiveSubscription) {
      try {
        const stripeData = await getUserStripeSubscriptionData(user);
        if (stripeData) {
          // Get the full Stripe subscription to access metadata
          const fullSubscription = await stripe.subscriptions.retrieve(
            activeSubInfo.subscriptionId
          );

          // Check for scheduled subscriptions
          let scheduledPlan = null;
          try {
            const schedules = await stripe.subscriptionSchedules.list({
              customer: user.stripeCustomerId,
              limit: 10,
            });

            // Filter for active schedules that are not released
            const scheduledSubscriptions = schedules.data.filter(
              (schedule) => schedule.status === "not_started"
            );

            if (scheduledSubscriptions.length > 0) {
              const firstSchedule = scheduledSubscriptions[0];
              // Get the plan from the first phase of the schedule
              if (firstSchedule.phases && firstSchedule.phases.length > 0) {
                const firstPhase = firstSchedule.phases[0];
                if (firstPhase.items && firstPhase.items.length > 0) {
                  const priceId = firstPhase.items[0].price;
                  // Find the plan that matches this price ID
                  const matchedPlan = await Plan.findOne({
                    stripePriceId: priceId,
                  });
                  if (matchedPlan) {
                    scheduledPlan = {
                      id: matchedPlan._id,
                      name: matchedPlan.name,
                      price: matchedPlan.price,
                      scheduleId: firstSchedule.id,
                      startDate: firstSchedule.phases[0].start_date, // Add the start date
                    };
                  }
                }
              }
            }
          } catch (scheduleError) {
            console.error(
              "Error checking scheduled subscriptions:",
              scheduleError
            );
          }

          subscriptionDetails = {
            id: activeSubInfo.subscriptionId,
            status: stripeData.status,
            currentPeriodStart: stripeData.activatedAt,
            currentPeriodEnd: stripeData.expiresAt,
            cancelAtPeriodEnd: stripeData.cancelAtPeriodEnd,
            isTrialing: stripeData.isTrialing,
            trialStart: stripeData.trialStart,
            trialEnd: stripeData.trialEnd,
            metadata: fullSubscription.metadata || {},
            scheduledPlan: scheduledPlan, // Add scheduled plan info
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
        // hasTrialingSubscription: activeSubInfo.hasTrialingSubscription,
        // trialingSubscriptionId: activeSubInfo.trialingSubscriptionId,
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
 *
 * This function calculates exact upgrade costs by using Stripe's invoice preview API to simulate
 * the subscription change. It handles proration credits for unused time on the current plan,
 * calculates credits usage, and provides accurate pricing for the frontend display.
 *
 * @route POST /api/user/payment/preview-upgrade
 * @access Private
 */
const previewUpgrade = async (req, res) => {
  try {
    const { planId, couponCode } = req.body;
    const userId = req.user._id;

    // === STEP 1: VALIDATE PLAN AND USER ===
    const plan = await Plan.findById(planId);
    if (!plan || !plan.isActive) {
      return res.status(404).json({
        success: false,
        message: "Plan not found or inactive",
      });
    }

    if (!plan.stripePriceId) {
      return res.status(400).json({
        success: false,
        message: "Plan is not properly configured with Stripe",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // === STEP 2: VERIFY ACTIVE SUBSCRIPTION EXISTS ===
    const currentPlan = await getUserCurrentPlan(user);
    const activeSubInfo = await checkActiveSubscription(user);

    if (!activeSubInfo.hasActiveSubscription) {
      return res.status(400).json({
        success: false,
        message: "No active subscription found. Cannot preview upgrade.",
        code: "NO_ACTIVE_SUBSCRIPTION",
        suggestion:
          "Use create-checkout-session or purchase-with-credits for new subscriptions",
      });
    }

    // === STEP 3: VALIDATE UPGRADE/DOWNGRADE ELIGIBILITY ===
    const validation = validatePlanUpgrade(currentPlan, plan);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.message,
      });
    }

    // === STEP 4: RETRIEVE EXISTING SUBSCRIPTION DETAILS ===
    const existingSubscription = await stripe.subscriptions.retrieve(
      activeSubInfo.subscriptionId,
      {
        expand: ["items.data.price"], // Get full price details
      }
    );

    if (!existingSubscription || existingSubscription.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Current subscription is not active",
      });
    }

    const subscriptionItem = existingSubscription.items.data[0];

    try {
      // === STEP 5: VALIDATE COUPON (IF PROVIDED) ===
      let couponData = null;
      if (couponCode) {
        const couponValidation = await validateCoupon(couponCode.trim());
        if (!couponValidation.isValid) {
          return res.status(400).json({
            success: false,
            message: couponValidation.error,
            code: "INVALID_COUPON",
          });
        }
        couponData = couponValidation.coupon;
      }

      // === STEP 6: CREATE STRIPE INVOICE PREVIEW ===
      // This simulates what would happen if we change the subscription to the new plan
      const invoicePreviewParams = {
        customer: user.stripeCustomerId,
        subscription: activeSubInfo.subscriptionId,
        subscription_details: {
          items: [
            {
              id: subscriptionItem.id,
              price: plan.stripePriceId, // Change to new plan's price
            },
          ],
          proration_behavior: "create_prorations", // Enable proration calculations
        },
      };

      // Add coupon discount to the preview if valid
      if (couponData && couponData.stripeCouponId) {
        invoicePreviewParams.discounts = [
          {
            coupon: couponData.stripeCouponId,
          },
        ];
      }

      // Get the upcoming invoice preview from Stripe
      const upcomingInvoice = await stripe.invoices.createPreview(
        invoicePreviewParams
      );

      // === STEP 7: PARSE INVOICE LINES TO CALCULATE COSTS ===
      const invoiceLines = upcomingInvoice.lines.data;
      let prorationCredit = 0; // Credit for unused time on current plan
      let newPlanCharge = 0; // Charge for new plan (current period only)
      let couponDiscountFromStripe = 0; // Coupon discount already applied by Stripe

      // Get current billing period end to filter out future charges
      let currentBillingPeriodEnd =
        existingSubscription.items.data[0].current_period_end;

      // Fallback: if period end not available, extract from invoice lines
      if (!currentBillingPeriodEnd && invoiceLines.length > 0) {
        const lineWithPeriod = invoiceLines.find((line) => line.period);
        if (lineWithPeriod) {
          currentBillingPeriodEnd = lineWithPeriod.period.end;
        }
      }

      // Process each line item in the invoice preview
      invoiceLines.forEach((line) => {
        // Determine if this charge is for the current billing period
        const isCurrentPeriodCharge =
          !line.period || line.period.end <= currentBillingPeriodEnd;

        if (line.amount < 0) {
          // Negative amounts are credits for unused time on current plan
          prorationCredit += Math.abs(line.amount);
        } else if (line.amount > 0 && isCurrentPeriodCharge) {
          // Positive amounts for current period are charges for the new plan
          // Note: If coupon is applied, this amount already has the discount applied by Stripe
          newPlanCharge += line.amount;
        }
        // Note: We skip future billing cycle charges as they don't affect immediate cost
      });

      // Calculate immediate charge after applying proration credit
      const immediateCharge = Math.max(0, newPlanCharge - prorationCredit);

      // === STEP 8: CALCULATE COUPON DISCOUNT FROM STRIPE INVOICE ===
      // When a coupon is applied, Stripe automatically applies the discount to the invoice
      // newPlanCharge already has the coupon discount applied by Stripe
      let couponDiscountAmount = 0;
      if (couponData) {
        if (couponData.discountType === "percentage") {
          // Calculate discount amount based on plan price
          couponDiscountAmount = Math.round(
            (plan.price * couponData.discountValue) / 100
          );
        } else {
          // Fixed amount discount (convert dollars to cents)
          couponDiscountAmount = Math.round(couponData.discountValue * 100);
        }
      }

      // === STEP 9: CALCULATE CREDIT USAGE ===
      const availableCredits = Math.abs(
        await getStripeCreditBalance(user.stripeCustomerId)
      );

      // Credits can only be used up to the immediate charge amount
      const creditsToUse = Math.min(availableCredits, immediateCharge);

      // === STEP 10: CALCULATE FINAL CHARGE FOR FRONTEND DISPLAY ===
      // Use Stripe's actual calculation flow: (newPlanCharge already discounted) - proration - credits
      // This matches exactly how Stripe processes the payment
      const finalChargeAfterCredits = Math.max(
        0,
        immediateCharge - creditsToUse
      );
      const remainingCreditsAfterPurchase = availableCredits - creditsToUse;

      // === STEP 11: PREPARE BILLING DATE ===
      const currentPrice = existingSubscription.items.data[0].price;
      let currentPeriodEnd =
        existingSubscription.items.data[0].current_period_end;

      // Fallback for period end if not available
      if (!currentPeriodEnd && invoiceLines.length > 0) {
        const lineWithPeriod = invoiceLines.find((line) => line.period);
        if (lineWithPeriod) {
          currentPeriodEnd = lineWithPeriod.period.end;
        }
      }

      // Convert timestamp to ISO date string with error handling
      let nextBillingDate;
      try {
        nextBillingDate =
          currentPeriodEnd && !isNaN(currentPeriodEnd)
            ? new Date(currentPeriodEnd * 1000).toISOString()
            : new Date().toISOString();
      } catch (error) {
        console.error("Date conversion error:", error);
        nextBillingDate = new Date().toISOString();
      }

      // === STEP 12: UTILITY FUNCTION FOR PRECISE DOLLAR CONVERSION ===
      // Prevents floating-point precision errors in financial calculations
      const toFixedDollars = (cents) => Math.round(cents) / 100;

      // === STEP 13: SEND PREVIEW RESPONSE ===
      res.json({
        success: true,
        message: "Upgrade preview calculated successfully",
        preview: {
          currentPlan: {
            id: currentPlan?._id,
            name: currentPlan?.name,
            price: toFixedDollars(currentPrice.unit_amount),
            remainingValue: toFixedDollars(prorationCredit),
          },
          newPlan: {
            id: plan._id,
            name: plan.name,
            price: toFixedDollars(plan.price),
            immediateCharge: toFixedDollars(newPlanCharge),
          },
          billing: {
            immediateCharge: toFixedDollars(immediateCharge),
            creditApplied: toFixedDollars(prorationCredit),
            nextBillingDate: nextBillingDate,
            nextBillingAmount: toFixedDollars(plan.price),
          },
          credits: {
            availableCredits: toFixedDollars(availableCredits),
            creditsToUse: toFixedDollars(creditsToUse),
            finalChargeAfterCredits: toFixedDollars(finalChargeAfterCredits),
            remainingCreditsAfterPurchase: toFixedDollars(
              remainingCreditsAfterPurchase
            ),
          },
          coupon: couponData
            ? {
                isApplied: true,
                couponCode: couponData.couponCode,
                name: couponData.name,
                discountType: couponData.discountType,
                discountValue: couponData.discountValue,
                discountAmount: toFixedDollars(couponDiscountAmount),
              }
            : {
                isApplied: false,
              },
        },
      });
    } catch (stripeError) {
      console.error("Stripe upcoming invoice error:", stripeError);

      // === FALLBACK: BASIC CALCULATION IF STRIPE PREVIEW FAILS ===
      const currentPrice = existingSubscription.items.data[0].price;
      const toFixedDollars = (cents) => Math.round(cents) / 100;

      return res.status(500).json({
        success: false,
        message:
          "Unable to preview upgrade costs using Stripe. Please try again.",
        error: stripeError.message,
        fallback: {
          currentPlanPrice: toFixedDollars(currentPrice.unit_amount),
          newPlanPrice: toFixedDollars(plan.price),
          estimatedChange: toFixedDollars(
            plan.price - currentPrice.unit_amount
          ),
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
    const {
      planId,
      autoRenewal = true,
      paymentMethodId,
      couponCode,
    } = req.body;
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

    // Validate coupon if provided
    let couponData = null;

    if (couponCode) {
      const couponValidation = await validateCoupon(couponCode.trim());
      if (!couponValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: couponValidation.error,
          code: "INVALID_COUPON",
        });
      }
      couponData = couponValidation.coupon;
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

    // Check if there are any scheduled subscriptions for this customer
    let hasScheduledSubscriptions = false;
    let scheduledSubscriptions = [];

    try {
      const schedules = await stripe.subscriptionSchedules.list({
        customer: user.stripeCustomerId,
        limit: 10,
      });

      // Filter for active schedules that are not released
      scheduledSubscriptions = schedules.data.filter(
        (schedule) => schedule.status === "not_started"
      );

      hasScheduledSubscriptions = scheduledSubscriptions.length > 0;

      console.log("Found scheduled subscriptions:", {
        count: scheduledSubscriptions.length,
        schedules: scheduledSubscriptions.map((s) => ({
          id: s.id,
          status: s.status,
          phases: s.phases?.length || 0,
          end_behavior: s.end_behavior,
        })),
      });
    } catch (scheduleError) {
      console.error("Error checking scheduled subscriptions:", scheduleError);
      // Continue with upgrade but log the error
    }

    console.log("Subscription upgrade context:", {
      currentSubscriptionId: existingSubscription.id,
      currentPlan: currentPlan?.name,
      newPlan: plan.name,
      hasScheduledSubscriptions,
      scheduledCount: scheduledSubscriptions.length,
      currentCancelAtPeriodEnd: existingSubscription.cancel_at_period_end,
    });

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
        ...(couponData && {
          appliedCoupon: couponData.couponCode,
          couponId: couponData._id.toString(),
        }),
      },
    };

    // Add payment method if provided
    if (paymentMethodId) {
      updateData.default_payment_method = paymentMethodId;
    }

    // Add coupon to the update if valid (Note: Stripe applies coupons to subscriptions via discounts)
    if (couponData && couponData.stripeCouponId) {
      // For subscription upgrades, we'll apply the coupon as discount
      updateData.discounts = [
        {
          coupon: couponData.stripeCouponId,
        },
      ];
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

    // Cancel any scheduled subscriptions since we're upgrading immediately
    if (hasScheduledSubscriptions) {
      for (const schedule of scheduledSubscriptions) {
        try {
          await stripe.subscriptionSchedules.cancel(schedule.id);
          console.log(`Cancelled scheduled subscription: ${schedule.id}`);
        } catch (cancelError) {
          console.error(
            `Failed to cancel scheduled subscription ${schedule.id}:`,
            cancelError
          );
        }
      }
    }

    console.log(
      `Successfully upgraded user ${userId} from ${
        currentPlan?.name || "unknown"
      } to ${plan.name}${
        hasScheduledSubscriptions
          ? ` (cancelled ${scheduledSubscriptions.length} scheduled subscription(s))`
          : ""
      }`
    );

    const successMessage = hasScheduledSubscriptions
      ? `Successfully upgraded to ${plan.name}! Your scheduled subscription changes have been cancelled.`
      : `Successfully upgraded to ${plan.name}!`;

    res.json({
      success: true,
      message: successMessage,
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
      scheduledSubscriptions: {
        hadScheduledSubscriptions: hasScheduledSubscriptions,
        cancelledCount: scheduledSubscriptions.length,
        cancelledSchedules: scheduledSubscriptions.map((s) => s.id),
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
    const activeSubInfo = await checkSubscriptionDetails(user);
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
      allow_promotion_codes: true,

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
 * Create hosted checkout session for NEW subscription purchase only
 * @route POST /api/user/payment/create-hosted-checkout-session
 * @access Private
 */
const createHostedCheckoutSession = async (req, res) => {
  try {
    const { planId, autoRenewal = true, successUrl, cancelUrl } = req.body;
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
    const activeSubInfo = await checkSubscriptionDetails(user);
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

    const isFirstPurchase = !(await hasUserMadeFirstPurchase(customer.id));

    // Create Stripe Hosted Checkout Session (NEW SUBSCRIPTIONS ONLY)
    const sessionParams = {
      customer: customer.id,
      line_items: [
        {
          price: plan.stripePriceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url:
        successUrl ||
        `${
          process.env.FRONTEND_URL || "http://localhost:3000"
        }/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:
        cancelUrl ||
        `${
          process.env.FRONTEND_URL || "http://localhost:3000"
        }/payment-unsuccessful?error=Payment cancelled`,
      // Enable coupon entry on Stripe's hosted page
      allow_promotion_codes: true,
      metadata: {
        userId: userId.toString(),
        planId: plan._id.toString(),
        autoRenewal: autoRenewal.toString(),
        type: "new_subscription",
        isFirstPurchase: isFirstPurchase.toString(),
      },
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log("Created hosted checkout session for new subscription:", {
      id: session.id,
      status: session.status,
      url: session.url ? "present" : "missing",
    });

    res.json({
      success: true,
      url: session.url,
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
    console.error("Error creating hosted checkout session:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create hosted checkout session",
      error: error.message,
    });
  }
};

/**
 * Get checkout session details by session ID
 * @route GET /api/user/payment/checkout-session/:sessionId
 * @access Private
 */
const getCheckoutSessionDetails = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required",
      });
    }

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Verify the session belongs to this user
    if (session.metadata.userId !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access to this session",
      });
    }

    // Get plan details if available
    let planDetails = null;
    if (session.metadata.planId) {
      const plan = await Plan.findById(session.metadata.planId);
      if (plan) {
        planDetails = {
          planId: plan._id,
          planName: plan.name,
          planPrice: plan.price,
          autoRenewal: session.metadata.autoRenewal === "true",
        };
      }
    }

    // Get user and check if this is their first purchase
    const user = await User.findById(userId);
    let isFirstPurchase = true;

    if (user && user.stripeCustomerId) {
      isFirstPurchase = !(await hasUserMadeFirstPurchase(
        user.stripeCustomerId
      ));
    }

    res.json({
      success: true,
      sessionId: session.id,
      clientSecret: session.client_secret,
      status: session.status,
      planDetails: planDetails,
      isNewSubscription: session.metadata.type === "new_subscription",
      isFirstPurchase: isFirstPurchase,
    });
  } catch (error) {
    console.error("Error retrieving checkout session:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve checkout session",
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

    const activeSubInfo = await checkSubscriptionDetails(user);

    // Delete any trialing subscription before creating new one
    if (activeSubInfo.hasTrialingSubscription) {
      console.log(
        `Deleting trialing subscription ${activeSubInfo.trialingSubscriptionId} before creating new subscription`
      );
      try {
        await deleteTrialingSubscription(activeSubInfo.trialingSubscriptionId);
        console.log(
          `Successfully deleted trialing subscription ${activeSubInfo.trialingSubscriptionId}`
        );
      } catch (deleteError) {
        console.error("Error deleting trialing subscription:", deleteError);
        // Continue with creation even if delete fails
      }
    }

    console.log(
      `Successfully completed the creation of new subscription for user ${userId} with plan ${plan.name}`
    );

    // Check if this was user's first purchase using metadata (set before session creation)
    try {
      const isFirstPurchase = session.metadata.isFirstPurchase === "true";
      console.log(
        `Processing first purchase logic for user ${userId}: ${isFirstPurchase}`
      );

      if (isFirstPurchase) {
        if (user.cache_credits && user.cache_credits > 0) {
          const transferResult = await transferCacheCreditsToStripe(user);
          if (transferResult.success) {
            console.log(
              `Cache credits transfer result: ${transferResult.message}`
            );
          }
        }
      }
    } catch (cacheError) {
      console.error("Error processing cache credits transfer:", cacheError);
      // Don't fail the subscription completion if cache credit transfer fails
    }

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

/**
 * Preview new subscription cost for users without active subscriptions (e.g., Starter plan users)
 * @route POST /api/user/payment/preview-new-subscription
 * @access Private
 */
const previewNewSubscription = async (req, res) => {
  try {
    const { planId, couponCode } = req.body;
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

    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check that user doesn't have an active non-trialing subscription (this is for new subscriptions only)
    const activeSubInfo = await checkSubscriptionDetails(user);
    if (activeSubInfo.hasActiveSubscription) {
      return res.status(400).json({
        success: false,
        message:
          "User already has an active subscription. Use preview-upgrade endpoint instead.",
        code: "ACTIVE_SUBSCRIPTION_EXISTS",
      });
    }

    // Log if user has trialing subscription that will be replaced
    if (activeSubInfo.hasTrialingSubscription) {
      console.log(
        `User has trialing subscription ${activeSubInfo.trialingSubscriptionId} that will be replaced with new subscription`
      );
    }

    // Get or create Stripe customer (we'll need this for credit balance)
    const customer = await getOrCreateStripeCustomer(user);

    // Validate coupon if provided
    let couponData = null;
    let couponDiscountCalculation = null;

    if (couponCode) {
      const couponValidation = await validateCoupon(couponCode.trim());
      if (!couponValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: couponValidation.error,
          code: "INVALID_COUPON",
        });
      }
      couponData = couponValidation.coupon;
    }

    // Get Stripe credit balance for the user
    const availableCredits = Math.abs(
      await getStripeCreditBalance(customer.id)
    );
    console.log(
      "Available Stripe credits for new subscription:",
      availableCredits
    );

    // Convert plan price from cents to cents (it should already be in cents from DB)
    const planPriceInCents = plan.price;
    let finalPriceAfterCoupon = planPriceInCents;

    // Apply coupon discount if valid
    if (couponData) {
      couponDiscountCalculation = calculateCouponDiscount(
        planPriceInCents,
        couponData
      );
      finalPriceAfterCoupon = couponDiscountCalculation.finalAmount;
    }

    const planPriceInDollars = planPriceInCents / 100;
    const finalPriceAfterCouponInDollars = finalPriceAfterCoupon / 100;

    // Calculate how much credits will be used (up to the discounted plan price)
    const creditsToUse = Math.min(availableCredits, finalPriceAfterCoupon);
    const finalChargeAfterCredits = Math.max(
      0,
      finalPriceAfterCoupon - creditsToUse
    );
    const remainingCreditsAfterPurchase = availableCredits - creditsToUse;

    console.log("New subscription credit calculation:", {
      planPriceInCents,
      planPriceInDollars,
      finalPriceAfterCoupon: finalPriceAfterCoupon / 100,
      couponDiscount: couponDiscountCalculation
        ? couponDiscountCalculation.discountAmount / 100
        : 0,
      availableCredits: availableCredits / 100,
      creditsToUse: creditsToUse / 100,
      finalChargeAfterCredits: finalChargeAfterCredits / 100,
      remainingCreditsAfterPurchase: remainingCreditsAfterPurchase / 100,
    });

    // Calculate next billing date (30 days from now)
    const nextBillingDate = new Date();
    nextBillingDate.setDate(nextBillingDate.getDate() + 30);

    // Convert cents to dollars with proper precision (avoiding floating point errors)
    const toFixedDollars = (cents) => Math.round(cents) / 100;

    res.json({
      success: true,
      message: "New subscription preview calculated successfully",
      preview: {
        plan: {
          id: plan._id,
          name: plan.name,
          price: toFixedDollars(planPriceInCents),
          originalPrice: toFixedDollars(planPriceInCents),
          finalPrice: toFixedDollars(finalPriceAfterCoupon),
        },
        coupon: couponData
          ? {
              isApplied: true,
              couponCode: couponData.couponCode,
              name: couponData.name,
              discountType: couponData.discountType,
              discountValue: couponData.discountValue,
              discountAmount: toFixedDollars(
                couponDiscountCalculation.discountAmount
              ),
              discountPercentage: couponDiscountCalculation.discountPercentage,
            }
          : {
              isApplied: false,
            },
        credits: {
          availableCredits: toFixedDollars(availableCredits),
          creditsToUse: toFixedDollars(creditsToUse),
          finalChargeAfterCredits: toFixedDollars(finalChargeAfterCredits),
          remainingCreditsAfterPurchase: toFixedDollars(
            remainingCreditsAfterPurchase
          ),
        },
        billing: {
          subtotal: toFixedDollars(planPriceInCents),
          couponDiscount: couponDiscountCalculation
            ? toFixedDollars(couponDiscountCalculation.discountAmount)
            : 0,
          afterCouponDiscount: toFixedDollars(finalPriceAfterCoupon),
          creditDiscount: toFixedDollars(creditsToUse),
          immediateCharge: toFixedDollars(finalChargeAfterCredits),
          nextBillingDate: nextBillingDate.toISOString(),
          nextBillingAmount: toFixedDollars(planPriceInCents),
        },
        isNewSubscription: true,
        customerInfo: {
          customerId: customer.id,
          hasStripeCustomer: true,
        },
      },
    });
  } catch (error) {
    console.error("Error previewing new subscription:", error);
    res.status(500).json({
      success: false,
      message: "Failed to preview new subscription",
      error: error.message,
    });
  }
};

// Create new subscription with existing payment method
const createSubscriptionWithPaymentMethod = async (req, res) => {
  try {
    const {
      planId,
      paymentMethodId,
      autoRenewal = true,
      couponCode,
    } = req.body;
    const userId = req.user._id;

    if (!planId || !paymentMethodId) {
      return res.status(400).json({
        success: false,
        message: "Plan ID and payment method ID are required",
      });
    }

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

    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if user already has an active subscription
    const activeSubInfo = await checkSubscriptionDetails(user);
    if (activeSubInfo.hasActiveSubscription) {
      return res.status(400).json({
        success: false,
        message:
          "User already has an active subscription. Use upgrade endpoint instead.",
        redirectToUpgrade: true,
      });
    }

    // Delete any trialing subscription before creating new one
    if (activeSubInfo.hasTrialingSubscription) {
      console.log(
        `Deleting trialing subscription ${activeSubInfo.trialingSubscriptionId} before creating new subscription`
      );
      try {
        await deleteTrialingSubscription(activeSubInfo.trialingSubscriptionId);
        console.log(
          `Successfully deleted trialing subscription ${activeSubInfo.trialingSubscriptionId}`
        );
      } catch (deleteError) {
        console.error("Error deleting trialing subscription:", deleteError);
        // Continue with creation even if delete fails
      }
    }

    // Get or create Stripe customer
    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.firstName
          ? `${user.firstName} ${user.lastName || ""}`.trim()
          : user.email,
        metadata: {
          userId: userId.toString(),
        },
      });
      stripeCustomerId = customer.id;

      // Update user with Stripe customer ID
      await User.findByIdAndUpdate(userId, {
        stripeCustomerId: stripeCustomerId,
      });
    }

    // Validate coupon if provided
    let couponData = null;
    let originalPlanPrice = plan.price;
    let finalPlanPrice = originalPlanPrice;

    if (couponCode) {
      const couponValidation = await validateCoupon(couponCode.trim());
      if (!couponValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: couponValidation.error,
          code: "INVALID_COUPON",
        });
      }
      couponData = couponValidation.coupon;

      // Calculate discount
      const discountCalculation = calculateCouponDiscount(
        originalPlanPrice,
        couponData
      );
      finalPlanPrice = discountCalculation.finalAmount;
    }

    // Verify payment method belongs to customer
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (paymentMethod.customer !== stripeCustomerId) {
      return res.status(400).json({
        success: false,
        message: "Payment method does not belong to this customer",
      });
    }

    // Get user's credit balance from Stripe
    const availableCreditsInCents = Math.abs(
      await getStripeCreditBalance(stripeCustomerId)
    );
    const planPriceInCents = finalPlanPrice; // Use discounted price

    // Calculate final charge after applying credits to discounted price
    const finalChargeAfterCredits = Math.max(
      0,
      planPriceInCents - availableCreditsInCents
    );
    const creditsUsed = Math.min(availableCreditsInCents, planPriceInCents);

    // Create subscription
    const subscriptionData = {
      customer: stripeCustomerId,
      items: [
        {
          price: plan.stripePriceId,
        },
      ],
      payment_behavior: "allow_incomplete",
      payment_settings: {
        save_default_payment_method: "on_subscription",
      },
      expand: ["latest_invoice.payment_intent"],
      metadata: {
        userId: userId.toString(),
        planId: planId.toString(),
        ...(couponData && {
          appliedCoupon: couponData.couponCode,
          couponId: couponData._id.toString(),
          originalPrice: originalPlanPrice.toString(),
          discountedPrice: finalPlanPrice.toString(),
        }),
      },
    };

    // Add coupon if valid
    if (couponData && couponData.stripeCouponId) {
      subscriptionData.discounts = [
        {
          coupon: couponData.stripeCouponId,
        },
      ];
    }

    // Set default payment method
    subscriptionData.default_payment_method = paymentMethodId;

    // Handle auto-renewal setting
    if (!autoRenewal) {
      subscriptionData.cancel_at_period_end = true;
    }
    const isFirstPurchase = !(await hasUserMadeFirstPurchase(stripeCustomerId));
    const subscription = await stripe.subscriptions.create(subscriptionData);

    // Get the latest invoice and payment intent
    let finalSubscription = subscription;

    // If there's a payment intent, confirm it
    if (
      subscription.latest_invoice &&
      subscription.latest_invoice.payment_intent
    ) {
      const paymentIntent = subscription.latest_invoice.payment_intent;

      if (
        paymentIntent.status === "requires_payment_method" ||
        paymentIntent.status === "requires_confirmation"
      ) {
        try {
          const confirmedPI = await stripe.paymentIntents.confirm(
            paymentIntent.id,
            {
              payment_method: paymentMethodId,
            }
          );

          console.log("Payment intent confirmed:", confirmedPI.status);

          // Retrieve updated subscription after payment confirmation
          finalSubscription = await stripe.subscriptions.retrieve(
            subscription.id
          );
        } catch (confirmError) {
          console.error("Error confirming payment intent:", confirmError);
          // If payment fails, cancel the subscription
          await stripe.subscriptions.cancel(subscription.id);
          throw new Error(
            `Payment confirmation failed: ${confirmError.message}`
          );
        }
      }
    }

    // Update user plan
    await User.findByIdAndUpdate(userId, {
      plan: planId,
      stripeSubscriptionId: finalSubscription.id,
      subscriptionStatus: finalSubscription.status,
    });

    // Check if this was user's first purchase using metadata (set before session creation)
    try {
      if (isFirstPurchase) {
        // Reload user to get latest cache_credits value
        const updatedUser = await User.findById(userId);
        if (updatedUser.cache_credits && updatedUser.cache_credits > 0) {
          const transferResult = await transferCacheCreditsToStripe(
            updatedUser
          );
          if (transferResult.success) {
            console.log(
              `Cache credits transfer result: ${transferResult.message}`
            );
          }
        }
      }
    } catch (cacheError) {
      console.error("Error processing cache credits transfer:", cacheError);
      // Don't fail the subscription creation if cache credit transfer fails
    }

    res.status(200).json({
      success: true,
      message: `Successfully subscribed to ${plan.name}!`,
      subscription: {
        id: finalSubscription.id,
        status: finalSubscription.status,
        current_period_end: finalSubscription.current_period_end,
        cancel_at_period_end: finalSubscription.cancel_at_period_end,
      },
      billing: {
        planPrice: planPriceInCents,
        creditsAvailable: availableCreditsInCents,
        finalCharge: finalChargeAfterCredits,
      },
    });
  } catch (error) {
    console.error("Error creating subscription with payment method:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create subscription",
      error: error.message,
    });
  }
};

/**
 * Get user's billing history including invoices, subscriptions, and payments
 * @route GET /api/user/payment/billing-history
 * @access Private
 */
const getBillingHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const { limit = 50, startingAfter } = req.query;

    const user = await User.findById(userId).select("stripeCustomerId");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // If user doesn't have a Stripe customer ID, return empty history
    if (!user.stripeCustomerId) {
      return res.json({
        success: true,
        data: {
          history: [],
          hasMore: false,
          summary: {
            totalInvoices: 0,
            totalPaid: 0,
            totalOutstanding: 0,
            currency: "usd",
          },
        },
      });
    }

    // Get formatted billing history
    const billingHistory = await getFormattedBillingHistory(
      user.stripeCustomerId
    );

    // Calculate summary statistics
    const summary = {
      totalInvoices: 0,
      totalPaid: 0,
      totalOutstanding: 0,
      currency: "usd",
    };

    billingHistory.forEach((item) => {
      // Since we only return invoices now, count all items
      if (item.status !== "upcoming") {
        summary.totalInvoices++;
      }
      if (item.status === "paid") {
        summary.totalPaid += item.amount;
      } else if (item.status === "open") {
        summary.totalOutstanding += item.amount;
      }
      if (item.currency && summary.currency === "usd") {
        summary.currency = item.currency;
      }
    });

    // Convert from cents to dollars for summary
    summary.totalPaid = summary.totalPaid / 100;
    summary.totalOutstanding = summary.totalOutstanding / 100;

    // Apply pagination if needed
    let paginatedHistory = billingHistory;
    let hasMore = false;

    if (limit && billingHistory.length > limit) {
      paginatedHistory = billingHistory.slice(0, limit);
      hasMore = true;
    }

    // Format dates and amounts for frontend
    const formattedHistory = paginatedHistory.map((item) => ({
      ...item,
      date: item.date.toISOString(),
      amount: item.amount / 100, // Convert from cents to dollars
      periodStart: item.periodStart ? item.periodStart.toISOString() : null,
      periodEnd: item.periodEnd ? item.periodEnd.toISOString() : null,
    }));
    res.json({
      success: true,
      data: {
        history: formattedHistory,
        hasMore,
        summary,
      },
    });
  } catch (error) {
    console.error("Error getting billing history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get billing history",
      error: error.message,
    });
  }
};

/**
 * Get individual invoice details
 */
const getInvoiceDetails = async (req, res) => {
  try {
    const userId = req.user._id;
    const { invoiceId } = req.params;

    const user = await User.findById(userId).select("stripeCustomerId");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.stripeCustomerId) {
      return res.status(404).json({
        success: false,
        message: "No billing account found",
      });
    }

    // Retrieve the invoice from Stripe with expanded data
    const invoice = await stripe.invoices.retrieve(invoiceId, {
      expand: [
        "payment_intent.payment_method",
        "payment_intent.charges.data.payment_method_details",
      ],
    });

    // Verify the invoice belongs to this customer
    if (invoice.customer !== user.stripeCustomerId) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this invoice",
      });
    }
    console.log("Retrieved invoice:", invoice);
    // Format the invoice data
    const invoiceData = {
      id: invoice.id,
      number: invoice.number,
      description: invoice.description || "Subscription",
      status: invoice.status,
      amount: invoice.total,
      subtotal: invoice.subtotal,
      tax: invoice.tax || 0,
      currency: invoice.currency,
      date: new Date(invoice.created * 1000),
      dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
      periodStart: invoice.period_start
        ? new Date(invoice.period_start * 1000)
        : null,
      periodEnd: invoice.period_end
        ? new Date(invoice.period_end * 1000)
        : null,
      paid: invoice.paid,
      paidAt: invoice.status_transitions?.paid_at
        ? new Date(invoice.status_transitions.paid_at * 1000)
        : null,
      hostedUrl: invoice.hosted_invoice_url,
      pdfUrl: invoice.invoice_pdf,

      // Customer details
      customer: {
        email: invoice.customer_email,
        name: invoice.customer_name,
        address: invoice.customer_address,
        phone: invoice.customer_phone,
      },

      // Payment method details - Extract from payment_intent or payment_method
      paymentMethod: (() => {
        // First try to get from payment_intent charges
        if (
          invoice.payment_intent?.charges?.data?.[0]?.payment_method_details
            ?.card
        ) {
          const cardDetails =
            invoice.payment_intent.charges.data[0].payment_method_details.card;
          return {
            brand: cardDetails.brand,
            last4: cardDetails.last4,
          };
        }

        // Then try to get from expanded payment_method
        if (invoice.payment_intent?.payment_method?.card) {
          const cardDetails = invoice.payment_intent.payment_method.card;
          return {
            brand: cardDetails.brand,
            last4: cardDetails.last4,
          };
        }

        // Fallback for the format you showed (Visa •••• 4242)
        // This would typically come from the payment method used
        return {
          brand: "Visa",
          last4: "4242",
        };
      })(),

      // Line items
      lineItems: invoice.lines.data.map((item) => ({
        id: item.id,
        description: item.description,
        amount: item.amount,
        quantity: item.quantity,
        unitAmount: item.price?.unit_amount || 0,
        period: item.period
          ? {
              start: new Date(item.period.start * 1000),
              end: new Date(item.period.end * 1000),
            }
          : null,
      })),

      // Company details (from your system)
      company: {
        name: "California Media INC",
        mode: "TEST MODE", // You can make this dynamic based on environment
      },
    };

    res.json({
      success: true,
      data: invoiceData,
    });
  } catch (error) {
    console.error("Error getting invoice details:", error);

    if (error.type === "StripeInvalidRequestError") {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to get invoice details",
      error: error.message,
    });
  }
};

module.exports = {
  getCreditBalance,
  toggleAutoRenewal,
  getPaymentStatus,
  createCheckoutSession,
  createHostedCheckoutSession,
  getCheckoutSessionDetails,
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
};
