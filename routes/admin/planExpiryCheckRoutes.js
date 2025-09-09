const { Router } = require("express");
const { manualPlanExpiryCheck } = require("../../utils/planScheduler");
const { checkForAuthentication } = require("../../middlewares/authentication");
const checkRole = require("../../middlewares/roleCheck");

const router = Router();

/**
 * @swagger
 * /admin/plan-expiry-check:
 *   post:
 *     summary: Manually trigger plan expiry check for all users
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Plan expiry check completed
 */

router.post(
  "/plan-expiry-check",
  checkForAuthentication(),
  checkRole("superadmin"),
  async (req, res) => {
    try {
      const result = await manualPlanExpiryCheck();

      if (result.error) {
        return res.status(500).json({
          status: "error",
          message: "Plan expiry check failed",
          error: result.error,
        });
      }

      return res.json({
        status: "success",
        message: "Plan expiry check completed",
        data: {
          processed: result.processed,
          updated: result.updated,
        },
      });
    } catch (error) {
      console.error("Error in manual plan expiry check:", error);
      return res.status(500).json({
        status: "error",
        message: "Internal server error",
        error: error.message,
      });
    }
  }
);

module.exports = router;
