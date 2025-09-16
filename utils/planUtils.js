const Plan = require("../models/planModel");
const User = require("../models/userModel");

/**
 * Calculate expiry date based on plan's price period
 * @param {Date} startDate - The start date
 * @param {String} pricePeriod - The price period from plan (month, year, lifetime, custom)
 * @returns {Date|null} The calculated expiry date or null for lifetime
 */
function calculateExpiryDate(startDate, pricePeriod) {
  const expiryDate = new Date(startDate);

  switch (pricePeriod) {
    case "month":
      expiryDate.setMonth(expiryDate.getMonth() + 1);
      break;
    case "year":
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      break;
    case "lifetime":
      return null; // Lifetime plans don't expire
    default:
      // Default to monthly if pricePeriod is not recognized
      expiryDate.setMonth(expiryDate.getMonth() + 1);
      break;
  }

  return expiryDate;
}

/**
 * Get the default plan for new users
 * @returns {Object|null} Plan object or null
 */
async function getDefaultPlan() {
  try {
    // First try to find Pro plan
    let plan = await Plan.findOne({ name: "Pro", isActive: true });

    if (!plan) {
      // If Pro doesn't exist, get the first active plan
      plan = await Plan.findOne({ isActive: true }).sort({ createdAt: 1 });
    }

    return plan;
  } catch (error) {
    console.error("Error getting default plan:", error);
    return null;
  }
}

/**
 * Get the Starter plan
 * @returns {Object|null} Starter plan object or null
 */
async function getStarterPlan() {
  try {
    const starterPlan = await Plan.findOne({ name: "Starter", isActive: true });
    return starterPlan;
  } catch (error) {
    console.error("Error getting Starter plan:", error);
    return null;
  }
}

/**
 * Get the Pro plan
 * @returns {Object|null} Pro plan object or null
 */
async function getProPlan() {
  try {
    const proPlan = await Plan.findOne({ name: "Pro", isActive: true });
    return proPlan;
  } catch (error) {
    console.error("Error getting Pro plan:", error);
    return null;
  }
}

/**
 * Setup initial plan for new user with Stripe subscription integration
 * @param {Object} user - User object (optional, for checking trial status)
 * @param {Object} plan - Plan to assign (optional, will use default if not provided)
 * @returns {Object} Updated user data with plan details
 */
async function setupInitialPlan(user = null, plan = null) {
  try {
    // With Stripe subscriptions, we start users on Starter plan
    // Pro trials/subscriptions are created via Stripe when user upgrades
    const starterPlan = await getStarterPlan();

    if (!starterPlan) {
      console.warn("No Starter plan found, user will have no plan assigned");
      return {
        plan: null,
        planActivatedAt: null,
        planExpiresAt: null,
        isPremium: false,
        trialStart: null,
        trialEnd: null,
      };
    }

    const now = new Date();

    // All new users start with Starter plan
    // Stripe subscriptions handle Pro plan trials and billing
    return {
      plan: starterPlan._id,
      planActivatedAt: now,
      planExpiresAt: null, // Starter plan doesn't expire
      isPremium: false, // Starter plan is not premium
      trialStart: null, // Trials managed by Stripe subscriptions
      trialEnd: null, // Trials managed by Stripe subscriptions
    };
  } catch (error) {
    console.error("Error setting up initial plan:", error);
    return {
      plan: null,
      planActivatedAt: null,
      planExpiresAt: null,
      isPremium: false,
      trialStart: null,
      trialEnd: null,
    };
  }
}

async function checkAndHandlePlanExpiry(user) {
  try {
    // With Stripe subscriptions, plan expiry is handled automatically via webhooks
    // This function is maintained for backward compatibility but Stripe manages lifecycle

    if (!user.plan || !user.stripeSubscriptionId) {
      return null; // No plan or no Stripe subscription
    }

    // If user has an active Stripe subscription, trust Stripe's status
    // The webhook handlers will update plan status based on subscription events
    if (user.stripeSubscriptionStatus === "active") {
      return null; // Active subscription, no action needed
    }

    // If subscription is not active and we reach here, let webhook handle it
    // This maintains existing behavior while allowing Stripe to be the source of truth
    console.log(
      `User ${user._id} subscription status: ${user.stripeSubscriptionStatus}. Webhook will handle status updates.`
    );

    return null;
  } catch (error) {
    console.error("Error in checkAndHandlePlanExpiry:", error);
    return null;
  }
}

/**
 * Check and handle plan expiry for users with already populated plan data
 * @param {Object} user - User object with populated plan
 * @returns {Object} Updated user data or null if no changes needed
 */
async function checkAndHandlePlanExpiryBatch(user) {
  try {
    // With Stripe subscriptions, plan expiry is handled automatically via webhooks
    // This function is maintained for backward compatibility but Stripe manages lifecycle

    if (!user.plan || !user.stripeSubscriptionId) {
      return null; // No plan or no Stripe subscription
    }

    // If user has an active Stripe subscription, trust Stripe's status
    // The webhook handlers will update plan status based on subscription events
    if (user.stripeSubscriptionStatus === "active") {
      return null; // Active subscription, no action needed
    }

    // If subscription is not active and we reach here, let webhook handle it
    console.log(
      `Batch check: User ${user._id} subscription status: ${user.stripeSubscriptionStatus}. Webhook will handle status updates.`
    );

    return null;
  } catch (error) {
    console.error("Error in checkAndHandlePlanExpiryBatch:", error);
    return null;
  }
}

/**
 * Validate and update user plan status
 * @param {String} userId - User ID
 * @returns {Object|null} Updated user or null if no changes
 */
async function validateAndUpdatePlanStatus(userId) {
  try {
    const user = await User.findById(userId).populate("plan");

    if (!user) {
      return null;
    }

    return await checkAndHandlePlanExpiry(user);
  } catch (error) {
    console.error(
      "Error validating plan status(validateAndUpdatePlanStatus):",
      error
    );
    return null;
  }
}

module.exports = {
  getDefaultPlan,
  getStarterPlan,
  getProPlan,
  setupInitialPlan,
  checkAndHandlePlanExpiry,
  checkAndHandlePlanExpiryBatch,
  validateAndUpdatePlanStatus,
};
