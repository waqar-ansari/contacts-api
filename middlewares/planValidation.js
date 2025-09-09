const { validateAndUpdatePlanStatus } = require("../utils/planUtils");

/**
 * Middleware to check and update user plan status
 * Should be used after authentication middleware
 */
const checkPlanStatus = () => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user._id) {
        return next(); // Skip if no user (should be caught by auth middleware)
      }

      // Validate and update plan status
      await validateAndUpdatePlanStatus(req.user._id);

      next();
    } catch (error) {
      console.error("Error checking plan status(checkPlanStatus middleware):", error);
      // Continue even if plan check fails - don't block the request
      next();
    }
  };
};

module.exports = { checkPlanStatus };
