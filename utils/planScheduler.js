const cron = require("node-cron");
const User = require("../models/userModel");
const { checkAndHandlePlanExpiry } = require("./planUtils");

/**
 * Check and handle expired plans for all users
 * This function should be called periodically
 */
async function checkAllExpiredPlans() {
  try {
    console.log("Starting plan expiry check for all users...");

    const now = new Date();

    // Find all users with plans that have expiry dates and are potentially expired
    const usersWithExpiringPlans = await User.find({
      plan: { $ne: null },
      planExpiresAt: { $lte: now },
    }).populate("plan");

    console.log(
      `Found ${usersWithExpiringPlans.length} users with potentially expired plans`
    );

    let processedCount = 0;
    let updatedCount = 0;

    for (const user of usersWithExpiringPlans) {
      try {
        const updatedUser = await checkAndHandlePlanExpiry(user);
        if (updatedUser) {
          updatedCount++;
        }
        processedCount++;
      } catch (error) {
        console.error(`Error processing user ${user._id}:`, error);
      }
    }

    console.log(
      `Plan expiry check completed. Processed: ${processedCount}, Updated: ${updatedCount}`
    );

    return { processed: processedCount, updated: updatedCount };
  } catch (error) {
    console.error("Error in checkAllExpiredPlans:", error);
    return { processed: 0, updated: 0, error: error.message };
  }
}

/**
 * Start the cron job to check expired plans
 * Runs every day at 2 AM
 */
function startPlanExpiryScheduler() {
  // Run every day at 2 AM
  cron.schedule("0 2 * * *", async () => {
    console.log("Running scheduled plan expiry check...");
    await checkAllExpiredPlans();
  });

  console.log("Plan expiry scheduler started - will run daily at 2 AM");
}

/**
 * Manually trigger plan expiry check (for testing or manual runs)
 */
async function manualPlanExpiryCheck() {
  console.log("Manual plan expiry check triggered");
  return await checkAllExpiredPlans();
}

module.exports = {
  checkAllExpiredPlans,
  startPlanExpiryScheduler,
  manualPlanExpiryCheck,
};
