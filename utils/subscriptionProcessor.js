const { stripe, stripeTest } = require("../config/stripe");
const Plan = require("../models/planModel");
const User = require("../models/userModel");
const {
  checkSubscriptionDetails,
  deleteTrialingSubscription,
  transferCacheCreditsToStripe,
} = require("./stripeUtils");
// In-memory store for tracking processed sessions
// In production, you should use Redis or a database table
const processedSessions = new Set();

/**
 * Process subscription completion logic
 * This function can be called from both API endpoints and webhooks
 * Includes idempotency protection to prevent duplicate processing
 *
 * @param {string} sessionId - Stripe checkout session ID
 * @param {Object} options - Optional parameters
 * @param {boolean} options.fromWebhook - Whether this is called from webhook
 * @param {string} options.userId - User ID (required for API calls, optional for webhooks)
 * @param {boolean} options.useTestMode - Whether to use test mode Stripe instance
 * @returns {Object} Result object with success status and data
 */
const processSubscriptionCompletion = async (sessionId, options = {}) => {
  const { fromWebhook = false, userId, useTestMode = false } = options;
  const stripeInstance = useTestMode ? stripeTest : stripe;

  try {
    console.log(
      `🔄 Processing subscription completion for session ${sessionId} (fromWebhook: ${fromWebhook}, testMode: ${useTestMode})`
    );

    // Check if this session has already been processed
    const processingKey = `${sessionId}`;
    if (processedSessions.has(processingKey)) {
      console.log(`✅ Session ${sessionId} already processed, skipping`);
      return {
        success: true,
        alreadyProcessed: true,
        message: "Session already processed",
      };
    }

    // Retrieve the checkout session
    const session = await stripeInstance.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "subscription.items.data.price"],
    });

    if (!session) {
      throw new Error("Checkout session not found");
    }

    if (session.payment_status !== "paid") {
      throw new Error("Payment not completed");
    }

    // Verify this is for a new subscription (not upgrade)
    if (session.metadata?.type !== "new_subscription") {
      throw new Error("This session is not for a new subscription");
    }

    const sessionUserId = session.metadata.userId;
    const { planId } = session.metadata;

    if (!sessionUserId || !planId) {
      throw new Error("Missing required metadata in session");
    }

    // For API calls, verify the session belongs to the requesting user
    if (!fromWebhook && userId && sessionUserId !== userId.toString()) {
      throw new Error("Unauthorized access to session");
    }

    // Get plan and user
    const [plan, user] = await Promise.all([
      Plan.findById(planId),
      User.findById(sessionUserId),
    ]);

    if (!plan || !user) {
      throw new Error("Plan or user not found");
    }

    // Mark as processing to prevent duplicates
    processedSessions.add(processingKey);

    console.log(
      `📝 Processing subscription for user ${sessionUserId} with plan ${plan.name}`
    );

    const activeSubInfo = await checkSubscriptionDetails(user, useTestMode);

    // Delete any trialing subscription before the new one becomes active
    if (activeSubInfo.hasTrialingSubscription) {
      console.log(
        `🗑️ Deleting trialing subscription ${activeSubInfo.trialingSubscriptionId}`
      );
      try {
        await deleteTrialingSubscription(
          activeSubInfo.trialingSubscriptionId,
          useTestMode
        );
        console.log("✅ Successfully deleted trialing subscription");
      } catch (deleteError) {
        console.error("❌ Error deleting trialing subscription:", deleteError);
        // Continue with processing even if delete fails
      }
    }

    // Handle first purchase logic and cache credits transfer
    try {
      const isFirstPurchase = session.metadata.isFirstPurchase === "true";
      console.log(`💳 Processing first purchase logic: ${isFirstPurchase}`);

      if (isFirstPurchase && user.cache_credits && user.cache_credits > 0) {
        console.log(
          `💰 Transferring ${user.cache_credits} cache credits to Stripe`
        );
        const transferResult = await transferCacheCreditsToStripe(
          user,
          useTestMode
        );

        if (transferResult.success) {
          console.log(
            "✅ Cache credits transfer successful:",
            transferResult.message
          );
        } else {
          console.error(
            "❌ Cache credits transfer failed:",
            transferResult.message
          );
        }
      }
    } catch (cacheError) {
      console.error("❌ Error processing cache credits transfer:", cacheError);
      // Don't fail the subscription completion if cache credit transfer fails
    }

    // Handle coupon usage tracking if a coupon was applied
    try {
      let stripeCouponId = null;
      let promotionCodeUsed = null;

      // Method 1: Check subscription discount (direct coupon application)
      if (session.subscription?.discount?.coupon) {
        stripeCouponId = session.subscription.discount.coupon.id;
        console.log(`🎟️ Found coupon on subscription: ${stripeCouponId}`);
      }

      // Method 2: Check invoice for discount (embedded checkout with promotion codes)
      if (!stripeCouponId && session.invoice) {
        console.log(
          `📄 Fetching invoice ${session.invoice} to check for discount...`
        );
        try {
          // Retrieve invoice with expanded discounts to get full discount objects
          const invoice = await stripeInstance.invoices.retrieve(
            session.invoice,
            {
              expand: ["discounts"],
            }
          );

          console.log(
            "📋 Invoice discounts array:",
            JSON.stringify(invoice.discounts, null, 2)
          );
          console.log(
            "📋 Invoice total_discount_amounts:",
            invoice.total_discount_amounts
          );

          // Check if invoice has discounts array
          if (invoice.discounts && invoice.discounts.length > 0) {
            const discount = invoice.discounts[0]; // Now this should be an expanded object
            console.log(
              `📄 Discount object:`,
              JSON.stringify(discount, null, 2)
            );

            // Access coupon and promotion_code from the expanded discount
            stripeCouponId = discount.coupon?.id;
            promotionCodeUsed = discount.promotion_code;

            console.log(
              `🎟️ Found coupon: ${stripeCouponId}${
                promotionCodeUsed
                  ? ` (promotion code: ${promotionCodeUsed})`
                  : ""
              }`
            );
          }
        } catch (invoiceError) {
          console.error(
            `❌ Error fetching invoice/discount: ${invoiceError.message}`
          );
        }
      }

      if (stripeCouponId) {
        console.log(
          `🎟️ Processing coupon usage for coupon ID: ${stripeCouponId}`
        );

        const Coupon = require("../models/couponModel");
        const couponDoc = await Coupon.findOne({ stripeCouponId });

        if (couponDoc) {
          await couponDoc.markUsedByUser(user._id, user.stripeCustomerId);
          console.log(
            `✅ Marked coupon ${couponDoc.couponCode} as used by user ${user._id}`
          );
        } else {
          console.log(
            `⚠️ Coupon with stripeCouponId ${stripeCouponId} not found in database`
          );
        }
      } else {
        console.log(`ℹ️ No coupon applied to this subscription`);
      }
    } catch (couponError) {
      console.error("❌ Error processing coupon usage:", couponError);
      // Don't fail the subscription completion if coupon tracking fails
    }

    console.log(
      `✅ Successfully completed subscription processing for session ${sessionId}`
    );

    return {
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
      fromWebhook,
    };
  } catch (error) {
    // Remove from processed set if there was an error
    const processingKey = `${sessionId}`;
    processedSessions.delete(processingKey);

    console.error(
      `❌ Error processing subscription completion for session ${sessionId}:`,
      error
    );
    throw error;
  }
};

/**
 * Clear the processed sessions cache (useful for testing)
 * In production with Redis/DB, this would clean up old entries
 */
const clearProcessedSessions = () => {
  processedSessions.clear();
  console.log("🧹 Cleared processed sessions cache");
};

/**
 * Check if a session has been processed
 */
const isSessionProcessed = (sessionId) => {
  return processedSessions.has(sessionId);
};

module.exports = {
  processSubscriptionCompletion,
  clearProcessedSessions,
  isSessionProcessed,
};
