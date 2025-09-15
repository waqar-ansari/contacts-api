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
    case "custom":
      // For custom, default to 30 days (you can modify this logic as needed)
      expiryDate.setDate(expiryDate.getDate() + 30);
      break;
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
 * Find the most expensive plan from remaining days array
 * @param {Array} remainingDaysArray - Array of remaining days objects
 * @returns {Object|null} Most expensive plan with remaining days or null
 */
function findMostExpensivePlanWithRemainingDays(remainingDaysArray) {
  if (!remainingDaysArray || remainingDaysArray.length === 0) return null;

  return remainingDaysArray
    .filter((item) => item.days > 0)
    .sort(
      (a, b) => (b.planSnapshot?.price || 0) - (a.planSnapshot?.price || 0)
    )[0];
}

/**
 * Apply stored remaining days from most expensive plan
 * @param {Object} user - User object
 * @param {Date} baseExpiryDate - Base expiry date to extend
 * @returns {Object} { newExpiryDate, usedRemainingDays, updatedRemainingDays }
 */
function applyStoredRemainingDaysUtil(user, baseExpiryDate) {
  const mostExpensivePlan = findMostExpensivePlanWithRemainingDays(
    user.remainingDays || []
  );

  if (!mostExpensivePlan) {
    return {
      newExpiryDate: baseExpiryDate,
      usedRemainingDays: null,
      updatedRemainingDays: user.remainingDays || [],
    };
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
}
async function checkAndHandlePlanExpiry(user) {
  try {
    if (!user.plan || !user.planExpiresAt) {
      return null; // No plan or no expiry date
    }

    const now = new Date();
    console.log("reached ", user);

    const currentPlan = await Plan.findById(user.plan);

    if (!currentPlan || currentPlan.name === "Starter") {
      console.log("current plan is starter, returning from middleware");
      return null; // Already on Starter or plan not found
    }
    // Check if plan has expired
    else if (user.planExpiresAt <= now) {
      // Check for auto-renewal first
      if (user.autoRenewal) {
        const renewalCost = currentPlan.price;

        // Try to renew with credits first (all or nothing)
        if (user.creditBalance >= renewalCost) {
          const newExpiryDate = calculateExpiryDate(
            now,
            currentPlan.pricePeriod
          );

          const updatedUser = await User.findByIdAndUpdate(
            user._id,
            {
              planActivatedAt: now,
              planExpiresAt: newExpiryDate,
              creditBalance: user.creditBalance - renewalCost,
              // Add remaining days from stored value if any
              remainingDays: user.remainingDays || 0,
            },
            { new: true }
          ).populate({
            path: "plan",
            select: "name price pricePeriod",
          });

          console.log(
            `Auto-renewed user ${user._id} plan using ${renewalCost} credits`
          );
          return updatedUser;
        } else {
          console.log(
            `User ${user._id} has insufficient credits (${user.creditBalance}) for auto-renewal (requires ${renewalCost}).`
          );

          // TODO: Implement Stripe auto-renewal here
          // For now, disable auto-renewal when credits insufficient
          // In production, this should trigger Stripe subscription payment
          console.log(
            `Auto-renewal disabled for user ${user._id} due to insufficient credits. Stripe auto-renewal not yet implemented.`
          );

          // Disable auto-renewal and continue with normal expiry logic
          await User.findByIdAndUpdate(user._id, { autoRenewal: false });
        }
      }

      // Check if user has credits for auto-upgrade to Pro (existing logic)
      const proPlan = await getProPlan();

      if (!proPlan) {
        console.log(`No Pro plan found for auto-upgrade for user ${user._id}`);
        // Continue to revert to Starter plan
      } else {
        // Use actual Pro plan price (assuming price is in cents, convert to credits)
        const requiredCredits = proPlan.price; // Convert cents to dollars (credits)

        if (user.creditBalance >= requiredCredits) {
          // Auto-upgrade to Pro using credits
          const newExpiryDate = calculateExpiryDate(now, proPlan.pricePeriod);

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
              onFreeTrial: false,
              hasUsedProTrial: true, // Mark trial as used (they're now paying with credits)
              // Preserve any remaining days from previous plan
              remainingDays: user.remainingDays || 0,
            },
            { new: true }
          ).populate({
            path: "plan",
            select: "name price pricePeriod",
          });

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

      // Revert to Starter plan and handle remaining days
      const starterPlan = await getStarterPlan();

      if (starterPlan) {
        const updateData = {
          plan: starterPlan._id,
          planActivatedAt: null,
          planExpiresAt: null, // Starter plan doesn't expire
          isPremium: false,
          onFreeTrial: false,
          trialStart: null,
          trialEnd: null,
        };

        // If user had remaining days from previous plan, add them to when the starter plan expires
        if (user.remainingDays > 0) {
          console.log(
            `User ${user._id} has ${user.remainingDays} remaining days from previous plan`
          );
          // For now, we'll just store the remaining days - they can be applied when user upgrades again
          updateData.remainingDays = user.remainingDays;
        }

        const updatedUser = await User.findByIdAndUpdate(user._id, updateData, {
          new: true,
        }).populate({
          path: "plan",
          select: "name price pricePeriod",
        });

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
 * Check and handle plan expiry for users with already populated plan data
 * @param {Object} user - User object with populated plan
 * @returns {Object} Updated user data or null if no changes needed
 */
async function checkAndHandlePlanExpiryBatch(user) {
  try {
    if (!user.plan || !user.planExpiresAt) {
      return null; // No plan or no expiry date
    }

    const now = new Date();

    // Use the populated plan data instead of querying again
    const currentPlan = user.plan;

    if (!currentPlan || currentPlan.name === "Starter") {
      return null; // Already on Starter or plan not found
    }

    // Check if plan has expired
    if (user.planExpiresAt <= now) {
      // Check for auto-renewal first
      if (user.autoRenewal) {
        const renewalCost = currentPlan.price;

        // Try to renew with credits first (all or nothing)
        if (user.creditBalance >= renewalCost) {
          const newExpiryDate = calculateExpiryDate(
            now,
            currentPlan.pricePeriod
          );

          const updatedUser = await User.findByIdAndUpdate(
            user._id,
            {
              planActivatedAt: now,
              planExpiresAt: newExpiryDate,
              creditBalance: user.creditBalance - renewalCost,
              // Add remaining days from stored value if any
              remainingDays: user.remainingDays || 0,
            },
            { new: true }
          ).populate({
            path: "plan",
            select: "name price pricePeriod",
          });

          console.log(
            `Auto-renewed user ${user._id} plan using ${renewalCost} credits`
          );
          return updatedUser;
        } else {
          console.log(
            `User ${user._id} has insufficient credits (${user.creditBalance}) for auto-renewal (requires ${renewalCost}).`
          );

          // TODO: Implement Stripe auto-renewal here
          // For now, disable auto-renewal when credits insufficient
          // In production, this should trigger Stripe subscription payment
          console.log(
            `Auto-renewal disabled for user ${user._id} due to insufficient credits. Stripe auto-renewal not yet implemented.`
          );

          // Disable auto-renewal and continue with normal expiry logic
          await User.findByIdAndUpdate(user._id, { autoRenewal: false });
        }
      }

      // Check if user has credits for auto-upgrade to Pro
      const proPlan = await getProPlan();

      if (!proPlan) {
        console.log(`No Pro plan found for auto-upgrade for user ${user._id}`);
        // Continue to revert to Starter plan
      } else {
        // Use actual Pro plan price (assuming price is in cents, convert to credits)
        const requiredCredits = proPlan.price;

        if (user.creditBalance >= requiredCredits) {
          // Auto-upgrade to Pro using credits
          const newExpiryDate = calculateExpiryDate(now, proPlan.pricePeriod);

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
              onFreeTrial: false,
              hasUsedProTrial: true, // Mark trial as used (they're now paying with credits)
              // Preserve any remaining days from previous plan
              remainingDays: user.remainingDays || 0,
            },
            { new: true }
          ).populate({
            path: "plan",
            select: "name price pricePeriod",
          });

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

      // Revert to Starter plan and handle remaining days
      const starterPlan = await getStarterPlan();

      if (starterPlan) {
        const updateData = {
          plan: starterPlan._id,
          planActivatedAt: null,
          planExpiresAt: null, // Starter plan doesn't expire
          isPremium: false,
          onFreeTrial: false,
          trialStart: null,
          trialEnd: null,
        };

        // If user had remaining days from previous plan, preserve them
        if (user.remainingDays > 0) {
          console.log(
            `User ${user._id} has ${user.remainingDays} remaining days from previous plan`
          );
          updateData.remainingDays = user.remainingDays;
        }

        const updatedUser = await User.findByIdAndUpdate(user._id, updateData, {
          new: true,
        }).populate({
          path: "plan",
          select: "name price pricePeriod",
        });

        console.log(`Reverted user ${user._id} to Starter plan due to expiry`);
        return updatedUser;
      }
    }

    return null; // No changes needed
  } catch (error) {
    console.error(
      "Error checking plan expiry(checkAndHandlePlanExpiryBatch):",
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
  checkAndHandlePlanExpiryBatch,
  validateAndUpdatePlanStatus,
};
