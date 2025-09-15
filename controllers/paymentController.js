const { stripe } = require("../config/stripe");
const Plan = require("../models/planModel");
const User = require("../models/userModel");
const Payment = require("../models/paymentModel");
const { calculateExpiryDate } = require("../utils/planUtils");

/**
 * Calculate the cost for upgrading to a new plan
 * User pays full price of new plan, remaining days from old plan are stored
 * @param {Object} currentPlan - Current plan object
 * @param {Object} newPlan - New plan object
 * @param {Number} remainingDays - Remaining days in current plan
 * @param {String} newPlanPeriod - New plan period (month, year, lifetime)
 * @returns {Object} { upgradeCost, remainingDays, newPlanPrice }
 */
const calculateUpgradeCost = (
  currentPlan,
  newPlan,
  remainingDays,
  newPlanPeriod
) => {
  try {
    // Simple logic: User pays full price of new plan
    // Remaining days from old plan are stored for later use
    return {
      upgradeCost: newPlan.price,
      remainingDays: remainingDays,
      newPlanPrice: newPlan.price,
      storedDays: remainingDays, // Days to be stored from previous plan
    };
  } catch (error) {
    console.error("Error calculating upgrade cost:", error);
    return {
      upgradeCost: newPlan.price,
      remainingDays: 0,
      newPlanPrice: newPlan.price,
      storedDays: 0,
    };
  }
};

/**
 * Calculate remaining days from current plan expiry
 * @param {Date} planExpiresAt - Current plan expiry date
 * @returns {Number} Number of days remaining
 */
const calculateRemainingDays = (planExpiresAt) => {
  if (!planExpiresAt) return 0;

  const now = new Date();
  const diffTime = planExpiresAt - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
};

/**
 * Find the most expensive plan from remaining days array
 * @param {Array} remainingDaysArray - Array of remaining days objects
 * @returns {Object|null} Most expensive plan with remaining days or null
 */
const findMostExpensivePlanWithRemainingDays = (remainingDaysArray) => {
  if (!remainingDaysArray || remainingDaysArray.length === 0) return null;

  return remainingDaysArray
    .filter((item) => item.days > 0)
    .sort(
      (a, b) => (b.planSnapshot?.price || 0) - (a.planSnapshot?.price || 0)
    )[0];
};

/**
 * Store remaining days from current plan for future use
 * @param {Object} user - User object
 * @param {Object} currentPlan - Current plan object
 * @param {Number} remainingDays - Days remaining in current plan
 * @returns {Array} Updated remaining days array
 */
const storeRemainingDays = (user, currentPlan, remainingDays) => {
  if (!currentPlan || remainingDays <= 0) return user.remainingDays || [];

  const remainingDaysArray = [...(user.remainingDays || [])];

  // Check if we already have remaining days for this plan
  const existingIndex = remainingDaysArray.findIndex(
    (item) => item.planId.toString() === currentPlan._id.toString()
  );

  if (existingIndex !== -1) {
    // Update existing entry
    remainingDaysArray[existingIndex].days += remainingDays;
  } else {
    // Add new entry
    remainingDaysArray.push({
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

  return remainingDaysArray;
};

/**
 * Apply stored remaining days from most expensive plan
 * @param {Object} user - User object
 * @param {Date} baseExpiryDate - Base expiry date to extend
 * @returns {Object} { newExpiryDate, usedRemainingDays }
 */
const applyStoredRemainingDays = (user, baseExpiryDate) => {
  const mostExpensivePlan = findMostExpensivePlanWithRemainingDays(
    user.remainingDays || []
  );

  if (!mostExpensivePlan) {
    return { newExpiryDate: baseExpiryDate, usedRemainingDays: null };
  }

  // Calculate new expiry date by adding remaining days
  const newExpiryDate = new Date(baseExpiryDate);
  newExpiryDate.setDate(newExpiryDate.getDate() + mostExpensivePlan.days);

  // Update remaining days array to remove used days
  const updatedRemainingDays = (user.remainingDays || [])
    .map((item) => {
      if (item.planId.toString() === mostExpensivePlan.planId.toString()) {
        return { ...item, days: 0 }; // Mark as used
      }
      return item;
    })
    .filter((item) => item.days > 0); // Remove entries with 0 days

  return {
    newExpiryDate,
    usedRemainingDays: mostExpensivePlan,
    updatedRemainingDays,
  };
};
/**
 * Create payment intent for plan purchase/upgrade
 * @route POST /api/user/payment/create-intent
 * @access Private
 */
const createPaymentIntent = async (req, res) => {
  try {
    const { planId, autoRenewal = false } = req.body;
    const userId = req.user._id;

    // Validate plan
    const plan = await Plan.findById(planId);
    if (!plan || !plan.isActive) {
      return res.status(404).json({
        success: false,
        message: "Plan not found or inactive",
      });
    }

    // Get user with current plan
    const user = await User.findById(userId).populate("plan");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let finalAmount = plan.price;
    let upgradeCost = plan.price;
    let remainingValue = 0;
    let isUpgrade = false;

    // Check if this is an upgrade
    if (user.plan && user.planExpiresAt) {
      const remainingDays = calculateRemainingDays(user.planExpiresAt);

      if (remainingDays > 0) {
        isUpgrade = true;
        const upgradeCalculation = calculateUpgradeCost(
          user.plan,
          plan,
          remainingDays,
          plan.pricePeriod
        );

        upgradeCost = upgradeCalculation.upgradeCost;
        remainingValue = 0; // No value deduction, remaining days will be stored
        finalAmount = upgradeCost; // User pays full price of new plan
      }
    }

    // Check if user can pay with credits (all or nothing)
    const availableCredits = user.creditBalance || 0;

    if (availableCredits >= finalAmount) {
      // Can pay entirely with credits
      return res.json({
        success: true,
        paymentMethod: "credits",
        planDetails: {
          planId: plan._id,
          planName: plan.name,
          planPrice: plan.price,
          finalAmount,
          upgradeCost,
          remainingValue,
          isUpgrade,
          autoRenewal,
        },
        credits: {
          available: availableCredits,
          required: finalAmount,
          willUse: finalAmount,
        },
      });
    }

    // Create Stripe payment intent for full amount (no partial credits)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: finalAmount * 100, // Amount in cents
      currency: "usd",
      metadata: {
        userId: userId.toString(),
        planId: planId.toString(),
        planName: plan.name,
        creditUsage: "0", // No credits used in Stripe payments
        finalAmount: finalAmount.toString(),
        isUpgrade: isUpgrade.toString(),
        remainingValue: remainingValue.toString(),
        autoRenewal: autoRenewal.toString(),
      },
    });

    res.json({
      success: true,
      paymentMethod: "stripe",
      clientSecret: paymentIntent.client_secret,
      planDetails: {
        planId: plan._id,
        planName: plan.name,
        planPrice: plan.price,
        finalAmount,
        upgradeCost,
        remainingValue,
        isUpgrade,
        autoRenewal,
      },
      credits: {
        available: availableCredits,
        willUse: 0, // No credits used in Stripe payments
      },
      stripe: {
        amount: finalAmount,
        paymentIntentId: paymentIntent.id,
      },
    });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create payment intent",
      error: error.message,
    });
  }
};

/**
 * Process plan purchase/upgrade using credits only
 * @route POST /api/user/payment/purchase-with-credits
 * @access Private
 */
const purchaseWithCredits = async (req, res) => {
  try {
    const { planId, autoRenewal = false } = req.body;
    const userId = req.user._id;

    // Validate plan
    const plan = await Plan.findById(planId);
    if (!plan || !plan.isActive) {
      return res.status(404).json({
        success: false,
        message: "Plan not found or inactive",
      });
    }

    // Get user with current plan
    const user = await User.findById(userId).populate("plan");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let finalAmount = plan.price;
    let remainingDaysToStore = 0;
    let isUpgrade = false;
    let remainingValue = 0;
    let previousPlan = null;

    // Check if this is an upgrade
    if (user.plan && user.planExpiresAt) {
      const remainingDays = calculateRemainingDays(user.planExpiresAt);

      if (remainingDays > 0) {
        isUpgrade = true;
        const upgradeCalculation = calculateUpgradeCost(
          user.plan,
          plan,
          remainingDays,
          plan.pricePeriod
        );

        finalAmount = upgradeCalculation.upgradeCost; // Full price of new plan
        remainingValue = 0; // No value deduction
        remainingDaysToStore = remainingDays; // Store all remaining days
        previousPlan = {
          planId: user.plan._id,
          remainingDays: remainingDays,
          expiryDate: user.planExpiresAt,
        };
      }
    }

    // Check if user has enough credits
    const availableCredits = user.creditBalance || 0;
    if (availableCredits < finalAmount) {
      return res.status(400).json({
        success: false,
        message: "Insufficient credits",
        required: finalAmount,
        available: availableCredits,
      });
    }

    // Create payment record
    const payment = new Payment({
      userId: userId,
      planId: plan._id,
      paymentMethod: "credits",
      amounts: {
        totalAmount: plan.price,
        creditUsed: finalAmount,
        stripeAmount: 0,
        upgradeCost: finalAmount,
        remainingValue: remainingValue,
      },
      isUpgrade: isUpgrade,
      previousPlan: previousPlan,
      newPlan: {
        activatedAt: new Date(),
        expiresAt: calculateExpiryDate(new Date(), plan.pricePeriod),
        autoRenewal: autoRenewal,
      },
      status: "completed",
      completedAt: new Date(),
    });

    // Store remaining days from current plan
    let updatedRemainingDays = user.remainingDays || [];
    if (isUpgrade && user.plan && remainingDaysToStore > 0) {
      updatedRemainingDays = storeRemainingDays(
        user,
        user.plan,
        remainingDaysToStore
      );
    }

    // Calculate new expiry date (potentially extended by stored remaining days)
    const baseExpiryDate = calculateExpiryDate(new Date(), plan.pricePeriod);
    const {
      newExpiryDate,
      usedRemainingDays,
      updatedRemainingDays: finalRemainingDays,
    } = applyStoredRemainingDays(
      { remainingDays: updatedRemainingDays },
      baseExpiryDate
    );

    // Update payment record with final expiry date
    payment.newPlan.expiresAt = newExpiryDate;

    // Update user plan and deduct credits
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        plan: plan._id,
        planActivatedAt: new Date(),
        planExpiresAt: newExpiryDate,
        isPremium: plan.name !== "Starter",
        creditBalance: availableCredits - finalAmount,
        autoRenewal,
        remainingDays: finalRemainingDays || [],
        trialStart: null,
        trialEnd: null,
        onFreeTrial: false,
      },
      { new: true }
    ).populate("plan");

    // Save payment record
    await payment.save();

    res.json({
      success: true,
      message: "Plan purchased successfully with credits",
      user: {
        plan: updatedUser.plan,
        planActivatedAt: updatedUser.planActivatedAt,
        planExpiresAt: updatedUser.planExpiresAt,
        isPremium: updatedUser.isPremium,
        creditBalance: updatedUser.creditBalance,
        autoRenewal: updatedUser.autoRenewal,
        remainingDays: updatedUser.remainingDays,
      },
      transaction: {
        paymentId: payment.paymentId,
        method: "credits",
        amount: finalAmount,
        planName: plan.name,
        isUpgrade,
        usedRemainingDays: usedRemainingDays,
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
    const {
      planId,
      creditUsage,
      finalAmount,
      isUpgrade,
      remainingValue,
      autoRenewal,
    } = paymentIntent.metadata;

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

    // Store remaining days from current plan (for upgrades)
    let updatedRemainingDays = user.remainingDays || [];
    if (isUpgrade === "true" && user.plan && user.planExpiresAt) {
      const remainingDaysToStore = calculateRemainingDays(user.planExpiresAt);
      if (remainingDaysToStore > 0) {
        updatedRemainingDays = storeRemainingDays(
          user,
          user.plan,
          remainingDaysToStore
        );
      }
    }

    // Calculate new expiry date (potentially extended by stored remaining days)
    const baseExpiryDate = calculateExpiryDate(new Date(), plan.pricePeriod);
    const {
      newExpiryDate,
      usedRemainingDays,
      updatedRemainingDays: finalRemainingDays,
    } = applyStoredRemainingDays(
      { remainingDays: updatedRemainingDays },
      baseExpiryDate
    );

    // Create payment record
    const payment = new Payment({
      userId: userId,
      planId: plan._id,
      paymentMethod: "stripe",
      stripePaymentIntentId: paymentIntentId,
      amounts: {
        totalAmount: parseInt(finalAmount),
        creditUsed: 0, // No credits used in Stripe payments
        stripeAmount: parseInt(finalAmount),
        upgradeCost: parseInt(finalAmount),
        remainingValue: parseInt(remainingValue),
      },
      isUpgrade: isUpgrade === "true",
      previousPlan:
        isUpgrade === "true" && user.plan
          ? {
              planId: user.plan._id,
              remainingDays: calculateRemainingDays(user.planExpiresAt),
              expiryDate: user.planExpiresAt,
            }
          : null,
      newPlan: {
        activatedAt: new Date(),
        expiresAt: newExpiryDate,
        autoRenewal: autoRenewal === "true",
      },
      status: "completed",
      completedAt: new Date(),
    });

    // Update user plan (no credit deduction for Stripe payments)
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        plan: plan._id,
        planActivatedAt: new Date(),
        planExpiresAt: newExpiryDate,
        isPremium: plan.name !== "Starter",
        autoRenewal: autoRenewal === "true",
        remainingDays: finalRemainingDays || [],
        trialStart: null,
        trialEnd: null,
        onFreeTrial: false,
      },
      { new: true }
    ).populate("plan");

    // Save payment record
    await payment.save();

    res.json({
      success: true,
      message: "Payment confirmed and plan updated successfully",
      user: {
        plan: updatedUser.plan,
        planActivatedAt: updatedUser.planActivatedAt,
        planExpiresAt: updatedUser.planExpiresAt,
        isPremium: updatedUser.isPremium,
        creditBalance: updatedUser.creditBalance,
        autoRenewal: updatedUser.autoRenewal,
        remainingDays: updatedUser.remainingDays,
      },
      transaction: {
        paymentId: payment.paymentId,
        paymentIntentId,
        method: "stripe",
        stripeAmount: parseInt(finalAmount),
        creditUsage: 0, // No credits used in Stripe payments
        totalAmount: parseInt(finalAmount),
        planName: plan.name,
        isUpgrade: isUpgrade === "true",
        usedRemainingDays: usedRemainingDays,
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
 * Toggle auto-renewal setting for user
 * @route PATCH /api/user/payment/auto-renewal
 * @access Private
 */
const toggleAutoRenewal = async (req, res) => {
  try {
    const { autoRenewal } = req.body;
    const userId = req.user._id;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { autoRenewal: Boolean(autoRenewal) },
      { new: true }
    ).populate("plan");

    res.json({
      success: true,
      message: `Auto-renewal ${
        autoRenewal ? "enabled" : "disabled"
      } successfully`,
      autoRenewal: updatedUser.autoRenewal,
    });
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
        "plan planActivatedAt planExpiresAt isPremium creditBalance autoRenewal remainingDays onFreeTrial trialStart trialEnd"
      );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let remainingDays = 0;
    if (user.planExpiresAt) {
      remainingDays = calculateRemainingDays(user.planExpiresAt);
    }

    res.json({
      success: true,
      data: {
        plan: user.plan,
        planActivatedAt: user.planActivatedAt,
        planExpiresAt: user.planExpiresAt,
        isPremium: user.isPremium,
        creditBalance: user.creditBalance,
        autoRenewal: user.autoRenewal,
        remainingDays,
        storedRemainingDays: user.remainingDays,
        onFreeTrial: user.onFreeTrial,
        trialStart: user.trialStart,
        trialEnd: user.trialEnd,
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
 * Process auto-renewal payment via Stripe
 * @param {Object} user - User object
 * @param {Object} plan - Plan object
 * @returns {Object} { success, user, error }
 */
const processAutoRenewalWithStripe = async (user, plan) => {
  try {
    const { stripe } = require("../config/stripe");

    // Create payment intent for auto-renewal
    const paymentIntent = await stripe.paymentIntents.create({
      amount: plan.price * 100, // Amount in cents
      currency: "usd",
      confirm: true, // Auto-confirm for server-side payments
      payment_method_types: ["card"],
      metadata: {
        userId: user._id.toString(),
        planId: plan._id.toString(),
        planName: plan.name,
        isAutoRenewal: "true",
      },
    });

    if (paymentIntent.status === "succeeded") {
      // Calculate new expiry date
      const now = new Date();
      const newExpiryDate = calculateExpiryDate(now, plan.pricePeriod);

      // Create payment record
      const payment = new Payment({
        userId: user._id,
        planId: plan._id,
        paymentMethod: "stripe",
        stripePaymentIntentId: paymentIntent.id,
        amounts: {
          totalAmount: plan.price,
          creditUsed: 0,
          stripeAmount: plan.price,
          upgradeCost: plan.price,
          remainingValue: 0,
        },
        isUpgrade: false,
        isAutoRenewal: true,
        newPlan: {
          activatedAt: now,
          expiresAt: newExpiryDate,
          autoRenewal: true,
        },
        status: "completed",
        completedAt: new Date(),
      });

      // Update user plan
      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        {
          planActivatedAt: now,
          planExpiresAt: newExpiryDate,
          autoRenewal: true, // Keep auto-renewal enabled
        },
        { new: true }
      ).populate("plan");

      // Save payment record
      await payment.save();

      console.log(
        `Auto-renewed user ${user._id} plan using Stripe payment ${paymentIntent.id}`
      );

      return { success: true, user: updatedUser };
    } else {
      console.error(
        `Stripe auto-renewal failed for user ${user._id}: ${paymentIntent.status}`
      );
      return { success: false, error: "Payment failed" };
    }
  } catch (error) {
    console.error(
      `Error processing Stripe auto-renewal for user ${user._id}:`,
      error
    );
    return { success: false, error: error.message };
  }
};

module.exports = {
  createPaymentIntent,
  purchaseWithCredits,
  confirmPayment,
  toggleAutoRenewal,
  getPaymentStatus,
  calculateUpgradeCost,
  calculateRemainingDays,
  processAutoRenewalWithStripe,
};
