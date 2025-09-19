const { stripe } = require("../config/stripe");
const User = require("../models/userModel");
const Plan = require("../models/planModel");

/**
 * Create a Stripe customer for a user
 * @param {Object} user - User object
 * @returns {Object} Stripe customer object
 */
async function createStripeCustomer(user) {
  try {
    const customer = await stripe.customers.create({
      email: user.email,
      name: `${user.firstname || ""} ${user.lastname || ""}`.trim(),
      metadata: {
        userId: user._id.toString(),
      },
    });

    // Update user with Stripe customer ID
    await User.findByIdAndUpdate(user._id, {
      stripeCustomerId: customer.id,
    });

    return customer;
  } catch (error) {
    console.error("Error creating Stripe customer:", error);
    throw error;
  }
}

/**
 * Get or create a Stripe customer for a user
 * @param {Object} user - User object
 * @returns {Object} Stripe customer object
 */
async function getOrCreateStripeCustomer(user) {
  try {
    if (user.stripeCustomerId) {
      // Try to retrieve existing customer
      try {
        const customer = await stripe.customers.retrieve(user.stripeCustomerId);
        if (!customer.deleted) {
          return customer;
        }
      } catch (error) {
        console.log(
          `Stripe customer ${user.stripeCustomerId} not found, creating new one`
        );
      }
    }

    // Create new customer if none exists or previous one was deleted
    return await createStripeCustomer(user);
  } catch (error) {
    console.error("Error getting or creating Stripe customer:", error);
    throw error;
  }
}

/**
 * Create a Stripe subscription for a user
 * @param {String} customerId - Stripe customer ID
 * @param {String} priceId - Stripe price ID
 * @param {Object} options - Additional options
 * @returns {Object} Stripe subscription object
 */
async function createStripeSubscription(customerId, priceId, options = {}) {
  try {
    const subscriptionData = {
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      expand: ["latest_invoice.payment_intent"],
      ...options,
    };

    // Add trial period if specified
    if (options.trialPeriodDays) {
      subscriptionData.trial_period_days = options.trialPeriodDays;
    }

    const subscription = await stripe.subscriptions.create(subscriptionData);

    return subscription;
  } catch (error) {
    console.error("Error creating Stripe subscription:", error);
    throw error;
  }
}

/**
 * Update a Stripe subscription with new price
 * @param {String} subscriptionId - Stripe subscription ID
 * @param {String} newPriceId - New Stripe price ID
 * @returns {Object} Updated Stripe subscription object
 */
async function updateStripeSubscriptionPrice(subscriptionId, newPriceId) {
  try {
    // Get current subscription to find the subscription item
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    // Update the subscription with new price
    const updatedSubscription = await stripe.subscriptions.update(
      subscriptionId,
      {
        items: [
          {
            id: subscription.items.data[0].id,
            price: newPriceId,
          },
        ],
        proration_behavior: "create_prorations", // Handle prorations
      }
    );

    return updatedSubscription;
  } catch (error) {
    console.error("Error updating Stripe subscription price:", error);
    throw error;
  }
}

/**
 * Update a Stripe subscription general data
 * @param {String} subscriptionId - Stripe subscription ID
 * @param {Object} updateData - Data to update
 * @returns {Object} Updated Stripe subscription object
 */
async function updateStripeSubscription(subscriptionId, updateData) {
  try {
    const subscription = await stripe.subscriptions.update(
      subscriptionId,
      updateData
    );
    return subscription;
  } catch (error) {
    console.error("Error updating Stripe subscription:", error);
    throw error;
  }
}

/**
 * Cancel a Stripe subscription
 * @param {String} subscriptionId - Stripe subscription ID
 * @param {Boolean} atPeriodEnd - Whether to cancel at period end
 * @returns {Object} Cancelled Stripe subscription object
 */
async function cancelStripeSubscription(subscriptionId, atPeriodEnd = true) {
  try {
    if (atPeriodEnd) {
      const subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
      return subscription;
    } else {
      const subscription = await stripe.subscriptions.cancel(subscriptionId);
      return subscription;
    }
  } catch (error) {
    console.error("Error canceling Stripe subscription:", error);
    throw error;
  }
}

/**
 * Retrieve a Stripe subscription
 * @param {String} subscriptionId - Stripe subscription ID
 * @returns {Object} Stripe subscription object
 */
async function getStripeSubscription(subscriptionId) {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    return subscription;
  } catch (error) {
    console.error("Error retrieving Stripe subscription:", error);
    throw error;
  }
}

/**
 * Get customer's billing credit balance from Stripe
 * @param {String} customerId - Stripe customer ID
 * @returns {Number} Credit balance in cents
 */
async function getStripeCreditBalance(customerId) {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    return customer.balance || 0; // Stripe customer balance (negative = credits)
  } catch (error) {
    console.error("Error getting Stripe credit balance:", error);
    return 0;
  }
}

/**
 * Add credits to customer's Stripe balance
 * @param {String} customerId - Stripe customer ID
 * @param {Number} amount - Amount in cents (negative for credits)
 * @param {String} description - Description for the balance transaction
 * @returns {Object} Stripe customer balance transaction
 */
async function addStripeCredits(customerId, amount, description) {
  try {
    const balanceTransaction = await stripe.customers.createBalanceTransaction(
      customerId,
      {
        amount: -Math.abs(amount), // Negative amount for credits
        currency: "usd",
        description: description,
      }
    );
    return balanceTransaction;
  } catch (error) {
    console.error("Error adding Stripe credits:", error);
    throw error;
  }
}

/**
 * Use credits from customer's Stripe balance
 * @param {String} customerId - Stripe customer ID
 * @param {Number} amount - Amount in cents to deduct
 * @param {String} description - Description for the balance transaction
 * @returns {Object} Stripe customer balance transaction
 */
async function useStripeCredits(customerId, amount, description) {
  try {
    const balanceTransaction = await stripe.customers.createBalanceTransaction(
      customerId,
      {
        amount: Math.abs(amount), // Positive amount to deduct credits
        currency: "usd",
        description: description,
      }
    );
    return balanceTransaction;
  } catch (error) {
    console.error("Error using Stripe credits:", error);
    throw error;
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
    console.error("Error getting plan from price ID:", error);
    return null;
  }
}

/**
 * Get user's current plan from their active subscription
 * @param {Object} user - User object with stripeCustomerId
 * @returns {Object|null} Plan object or null if no active subscription/plan
 */
async function getUserCurrentPlan(user) {
  try {
    if (!user.stripeCustomerId) {
      // Return starter plan as default if no Stripe customer
      return await Plan.findOne({ name: "Starter", isActive: true });
    }

    const subscription = await getCustomerPrimarySubscription(
      user.stripeCustomerId
    );

    if (!subscription) {
      // Return starter plan as default if no active subscription
      return await Plan.findOne({ name: "Starter", isActive: true });
    }

    const priceId = subscription.items.data[0]?.price?.id;
    const plan = await getPlanFromPriceId(priceId);

    // Fallback to starter plan if price ID doesn't match any plan
    return plan || (await Plan.findOne({ name: "Starter", isActive: true }));
  } catch (error) {
    console.error("Error getting user current plan:", error);
    // Return starter plan as fallback
    return await Plan.findOne({ name: "Starter", isActive: true });
  }
}

/**
 * Get all active subscriptions for a Stripe customer
 * @param {String} customerId - Stripe customer ID
 * @returns {Array} Array of active subscription objects
 */
async function getCustomerActiveSubscriptions(customerId) {
  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
    });

    // Filter for active, trialing, or past_due subscriptions
    const activeStatuses = ["active", "trialing", "past_due"];
    return subscriptions.data.filter((sub) =>
      activeStatuses.includes(sub.status)
    );
  } catch (error) {
    console.error("Error getting customer active subscriptions:", error);
    return [];
  }
}

/**
 * Get customer's primary active subscription (most recent active one)
 * @param {String} customerId - Stripe customer ID
 * @returns {Object|null} Active subscription object or null
 */
async function getCustomerPrimarySubscription(customerId) {
  try {
    const activeSubscriptions = await getCustomerActiveSubscriptions(
      customerId
    );

    if (activeSubscriptions.length === 0) {
      return null;
    }

    // Return the most recently created active subscription
    return activeSubscriptions.sort((a, b) => b.created - a.created)[0];
  } catch (error) {
    console.error("Error getting customer primary subscription:", error);
    return null;
  }
}

/**
 * Get user's Stripe subscription data using customer ID only
 * @param {Object} user - User object with stripeCustomerId
 * @returns {Object} Subscription data or null
 */
async function getUserStripeSubscriptionData(user) {
  try {
    if (!user.stripeCustomerId) {
      return null;
    }

    const subscription = await getCustomerPrimarySubscription(
      user.stripeCustomerId
    );

    if (!subscription) {
      return null;
    }

    return {
      id: subscription.id,
      status: subscription.status,
      isTrialing: subscription.status === "trialing",
      activatedAt: new Date(subscription.current_period_start * 1000),
      expiresAt: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      trialStart: subscription.trial_start
        ? new Date(subscription.trial_start * 1000)
        : null,
      trialEnd: subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null,
      priceId: subscription.items.data[0]?.price?.id,
      amount: subscription.items.data[0]?.price?.unit_amount,
      currency: subscription.items.data[0]?.price?.currency,
    };
  } catch (error) {
    console.error(
      `Error fetching subscription data for user ${user._id}:`,
      error
    );
    return null;
  }
}

/**
 * Check if customer has any payment methods attached
 * @param {String} customerId - Stripe customer ID
 * @returns {Boolean} True if customer has payment methods
 */
async function customerHasPaymentMethod(customerId) {
  try {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: "card",
    });
    return paymentMethods.data.length > 0;
  } catch (error) {
    console.error("Error checking customer payment methods:", error);
    return false;
  }
}

/**
 * Update subscription for admin - cancels current and creates new
 * @param {String} customerId - Stripe customer ID
 * @param {String} newPriceId - New Stripe price ID
 * @returns {Object} New Stripe subscription object
 */
async function updateSubscriptionForAdmin(customerId, newPriceId) {
  try {
    // Get current active subscription
    const currentSubscription = await getCustomerPrimarySubscription(
      customerId
    );

    if (currentSubscription) {
      // Cancel current subscription immediately for admin updates
      await stripe.subscriptions.cancel(currentSubscription.id);
    }

    // Create new subscription - customer should already have payment method
    const newSubscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: newPriceId }],
      proration_behavior: "none", // No proration/billing
      payment_behavior: "default_incomplete",
      payment_settings: {
        save_default_payment_method: "on_subscription",
      },
      metadata: {
        adminUpdate: "true",
        previousSubscription: currentSubscription?.id || "none",
        adminAssigned: new Date().toISOString(),
      },
    });

    return newSubscription;
  } catch (error) {
    console.error("Error updating subscription for admin:", error);
    throw error;
  }
}

module.exports = {
  createStripeCustomer,
  getOrCreateStripeCustomer,
  createStripeSubscription,
  updateStripeSubscription,
  updateStripeSubscriptionPrice,
  cancelStripeSubscription,
  getStripeSubscription,
  getStripeCreditBalance,
  addStripeCredits,
  useStripeCredits,
  getUserStripeSubscriptionData,
  updateSubscriptionForAdmin,
  customerHasPaymentMethod,
  getCustomerActiveSubscriptions,
  getCustomerPrimarySubscription,
  getPlanFromPriceId,
  getUserCurrentPlan,
};
