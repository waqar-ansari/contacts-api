const Plan = require("../models/planModel");
const User = require("../models/userModel");

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
 * Setup initial plan for new user
 * @param {Object} user - User object (optional, for checking trial status)
 * @param {Object} plan - Plan to assign (optional, will use default if not provided)
 * @returns {Object} Updated user data with plan details
 */
async function setupInitialPlan(user = null, plan = null) {
  try {
    const defaultPlan = plan || (await getDefaultPlan());

    if (!defaultPlan) {
      console.warn("No default plan found, user will have no plan assigned");
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
    let planExpiresAt = null;
    let isPremium = false;
    let trialStart = null;
    let trialEnd = null;

    // If it's Pro plan, give 14-day trial
    if (defaultPlan.name === "Pro") {
      planExpiresAt = new Date(now);
      planExpiresAt.setDate(planExpiresAt.getDate() + 14);
      isPremium = true;
      trialStart = now;
      trialEnd = planExpiresAt;
    } else if (defaultPlan.name !== "Starter") {
      // For other non-Starter plans, also give trial period
      planExpiresAt = new Date(now);
      planExpiresAt.setDate(planExpiresAt.getDate() + 14);
      isPremium = true;
      trialStart = now;
      trialEnd = planExpiresAt;
    }
    // For Starter plan, planExpiresAt remains null (no expiry)

    return {
      plan: defaultPlan._id,
      planActivatedAt: now,
      planExpiresAt,
      isPremium,
      trialStart,
      trialEnd,
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

/**
 * Check if user's plan has expired and handle accordingly
 * @param {Object} user - User object
 * @returns {Object} Updated user data or null if no changes needed
 */
async function checkAndHandlePlanExpiry(user) {
  try {
    if (!user.plan || !user.planExpiresAt) {
      return null; // No plan or no expiry date
    }

    const now = new Date();

    // Check if plan has expired
    if (user.planExpiresAt <= now) {
      const currentPlan = await Plan.findById(user.plan);

      if (!currentPlan || currentPlan.name === "Starter") {
        return null; // Already on Starter or plan not found
      }

      // Check if user has credits for auto-upgrade to Pro
      const proPlan = await getProPlan();

      if (!proPlan) {
        console.log(`No Pro plan found for auto-upgrade for user ${user._id}`);
        // Continue to revert to Starter plan
      } else {
        // Use actual Pro plan price (assuming price is in cents, convert to credits)
        const requiredCredits = proPlan.price / 100; // Convert cents to dollars (credits)

        if (user.creditBalance >= requiredCredits) {
          // Auto-upgrade to Pro using credits
          const newExpiryDate = new Date(now);
          newExpiryDate.setDate(newExpiryDate.getDate() + 30); // 30 days for paid Pro

          const updatedUser = await User.findByIdAndUpdate(
            user._id,
            {
              plan: proPlan._id,
              planActivatedAt: now,
              planExpiresAt: newExpiryDate,
              isPremium: true,
              creditBalance: user.creditBalance - requiredCredits, // Deduct actual plan price
              trialStart: null, // Not a trial anymore
              trialEnd: null,
              hasUsedProTrial: true, // Mark trial as used (they're now paying with credits)
            },
            { new: true }
          );

          console.log(
            `Auto-upgraded user ${user._id} to Pro plan using ${requiredCredits} credits`
          );
          return updatedUser;
        } else {
          console.log(
            `User ${user._id} has insufficient credits (${user.creditBalance}) for Pro plan (requires ${requiredCredits})`
          );
        }
      }

      // Revert to Starter plan
      const starterPlan = await getStarterPlan();

      if (starterPlan) {
        const updatedUser = await User.findByIdAndUpdate(
          user._id,
          {
            plan: starterPlan._id,
            planActivatedAt: now,
            planExpiresAt: null, // Starter plan doesn't expire
            isPremium: false,
            trialStart: null,
            trialEnd: null,
          },
          { new: true }
        );

        console.log(`Reverted user ${user._id} to Starter plan due to expiry`);
        return updatedUser;
      }
    }

    return null; // No changes needed
  } catch (error) {
    console.error(
      "Error checking plan expiry(checkAndHandlePlanExpiry):",
      error
    );
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
  validateAndUpdatePlanStatus,
};
