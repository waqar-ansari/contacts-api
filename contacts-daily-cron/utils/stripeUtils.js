const { stripe } = require("../config/stripe");
const Plan = require("../models/planModel");

/**
 * Get customer's primary active subscription (most recent active one)
 * Includes subscriptions that are active but set to cancel at period end
 * @param {String} customerId - Stripe customer ID
 * @returns {Object|null} Active subscription object or null
 */
async function getCustomerPrimarySubscription(customerId) {
  try {
    if (!customerId) return null;

    // Get all active and trialing subscriptions (including those set to cancel)
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 100, // Get all to find the one expiring soonest
    });

    if (subscriptions.data.length === 0) return null;

    // Filter for active or trialing subscriptions only
    const activeOrTrialing = subscriptions.data.filter(
      (sub) => sub.status === "active" || sub.status === "trialing"
    );

    if (activeOrTrialing.length === 0) return null;

    // If multiple subscriptions, return the one expiring soonest
    const sortedByExpiry = activeOrTrialing.sort((a, b) => {
      const aExpiry = a.trial_end || a.current_period_end;
      const bExpiry = b.trial_end || b.current_period_end;
      return aExpiry - bExpiry;
    });

    return sortedByExpiry[0];
  } catch (error) {
    console.error(
      "Error getting customer primary subscription:",
      error.message
    );
    return null;
  }
}

/**
 * Get plan from Stripe price ID
 * @param {String} priceId - Stripe price ID
 * @returns {Object|null} Plan object or null if not found
 */
async function getPlanFromPriceId(priceId) {
  try {
    if (!priceId) return null;

    const plan = await Plan.findOne({
      stripePriceId: priceId,
      isActive: true,
    });

    return plan;
  } catch (error) {
    console.error("Error getting plan from price ID:", error.message);
    return null;
  }
}

/**
 * Get user's current plan and expiry date
 * @param {Object} user - User object with stripeCustomerId
 * @returns {Object} Object containing plan and expiresAt
 */
async function getUserCurrentPlan(user) {
  try {
    // If no Stripe customer ID, return Starter plan with trial end
    if (!user.stripeCustomerId) {
      const starterPlan = await Plan.findOne({
        name: "Starter",
        isActive: true,
      });
      return { plan: starterPlan, expiresAt: user.trialEnd || null };
    }

    // Get the primary active subscription
    const subscription = await getCustomerPrimarySubscription(
      user.stripeCustomerId
    );

    if (!subscription) {
      const starterPlan = await Plan.findOne({
        name: "Starter",
        isActive: true,
      });
      return { plan: starterPlan, expiresAt: user.trialEnd || null };
    }

    // Get the price ID from the subscription
    const priceId = subscription.items?.data?.[0]?.price?.id;
    const plan = await getPlanFromPriceId(priceId);

    // Use current_period_end from subscription items (matches main API exactly)
    const expiresAt = subscription.items?.data?.[0]?.current_period_end
      ? new Date(subscription.items.data[0].current_period_end * 1000)
      : null;

    return {
      plan: plan || (await Plan.findOne({ name: "Starter", isActive: true })),
      expiresAt: expiresAt,
      subscriptionStatus: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
      isTrialing: subscription.status === "trialing",
    };
  } catch (err) {
    console.error("getUserCurrentPlan failed for", user.email, err.message);
    const fallbackPlan = await Plan.findOne({
      name: "Starter",
      isActive: true,
    });
    return { plan: fallbackPlan, expiresAt: user.trialEnd || null };
  }
}

module.exports = {
  getCustomerPrimarySubscription,
  getPlanFromPriceId,
  getUserCurrentPlan,
};
