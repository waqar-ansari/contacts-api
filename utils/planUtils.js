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
async function getDefaultPlan(useTestMode = false) {
  try {
    // First try to find Pro plan
    let plan = await Plan.findOne({
      name: "Pro",
      isActive: true,
      stripe_test_mode: useTestMode,
    });

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
async function getProPlan(useTestMode = false) {
  try {
    let proPlan = await Plan.findOne({
      name: "Pro",
      stripe_test_mode: useTestMode,
      isActive: true,
    });

    return proPlan;
  } catch (error) {
    console.error("Error getting Pro plan:", error);
    return null;
  }
}

/**
 * Setup initial plan for new user with 14-day Pro trial via Stripe subscription
 * @param {Object} user - User object (required for creating Stripe subscription)
 * @param {Object} plan - Plan to assign (optional, will use Pro plan for trial)
 * @returns {Object} Updated user data with plan details and Stripe customer info
 * @returns {Object} {plan: ObjectId|null, stripeCustomer: Object|null}
 */
async function setupInitialPlan(user, useTestMode = false) {
  try {
    if (!user) {
      console.error("User object is required for setupInitialPlan");
      return {
        plan: null,
      };
    }
    console.log("test mode val", useTestMode);
    // Get Pro plan for trial
    const proPlan = await getProPlan(useTestMode);

    if (!proPlan || !proPlan.stripePriceId) {
      console.warn(
        "No Pro plan with Stripe price found, falling back to Starter plan"
      );
      const starterPlan = await getStarterPlan();

      return {
        plan: starterPlan ? starterPlan._id : null,
        stripeCustomer: null,
        // No need to track hasUsedProTrial anymore
      };
    }

    // Import Stripe utilities
    const {
      getOrCreateStripeCustomer,
      createStripeSubscription,
    } = require("./stripeUtils");

    try {
      // Get or create Stripe customer
      const customer = await getOrCreateStripeCustomer(user, useTestMode);

      // Create 14-day Pro trial subscription that cancels at end of trial
      const subscriptionOptions = {
        trial_period_days: 14,
        cancel_at_period_end: true, // Cancel at end of trial (no recurring payment)
        metadata: {
          userId: user._id.toString(),
          planId: proPlan._id.toString(),
          planName: proPlan.name,
          isInitialTrial: "true",
          signupMethod: user.signupMethod || "unknown",
        },
      };

      const subscription = await createStripeSubscription(
        customer.id,
        proPlan.stripePriceId,
        subscriptionOptions,
        useTestMode
      );

      console.log(
        `Created 14-day Pro trial for user ${user._id}: ${subscription.id} (will cancel at trial end)`
      );

      return {
        plan: proPlan._id,
        stripeCustomer: customer,
        // No need to track hasUsedProTrial anymore
      };
    } catch (stripeError) {
      console.error("Error creating Stripe trial subscription:", stripeError);

      // Fall back to Starter plan if Stripe fails
      const starterPlan = await getStarterPlan();

      return {
        plan: starterPlan ? starterPlan._id : null,
        stripeCustomer: null,
        // No need to track hasUsedProTrial anymore
      };
    }
  } catch (error) {
    console.error("Error setting up initial plan:", error);
    return {
      plan: null,
      stripeCustomer: null,
      // No need to track hasUsedProTrial anymore
    };
  }
}

async function checkAndHandlePlanExpiry(user) {
  try {
    // With Stripe subscriptions, plan expiry is handled automatically via webhooks
    // This function is maintained for backward compatibility but Stripe manages lifecycle

    if (!user) {
      return null; // No user
    }

    // If user has an active Stripe subscription, trust Stripe's status
    // The webhook handlers will update plan status based on subscription events

    // If subscription is not active and we reach here, let webhook handle it
    // This maintains existing behavior while allowing Stripe to be the source of truth

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

    if (!user) {
      return null; // No user
    }

    // If user has an active Stripe subscription, trust Stripe's status
    // The webhook handlers will update plan status based on subscription events

    // If subscription is not active and we reach here, let webhook handle it

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
    const user = await User.findById(userId);

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
