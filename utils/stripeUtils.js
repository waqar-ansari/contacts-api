const { stripe } = require("../config/stripe");
const User = require("../models/userModel");

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
 * Update user's subscription data in database from Stripe subscription
 * @param {String} userId - User ID
 * @param {Object} subscription - Stripe subscription object
 * @returns {Object} Updated user object
 */
async function updateUserSubscriptionData(userId, subscription) {
  try {
    const updateData = {
      stripeSubscriptionId: subscription.id,
      stripeSubscriptionStatus: subscription.status,
      stripeCurrentPeriodStart: new Date(
        subscription.current_period_start * 1000
      ),
      stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
      stripeCancelAtPeriodEnd: subscription.cancel_at_period_end,
    };

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
    });
    return updatedUser;
  } catch (error) {
    console.error("Error updating user subscription data:", error);
    throw error;
  }
}

/**
 * Clear user's subscription data in database
 * @param {String} userId - User ID
 * @returns {Object} Updated user object
 */
async function clearUserSubscriptionData(userId) {
  try {
    const updateData = {
      stripeSubscriptionId: null,
      stripeSubscriptionStatus: null,
      stripeCurrentPeriodStart: null,
      stripeCurrentPeriodEnd: null,
      stripeCancelAtPeriodEnd: false,
    };

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
    });
    return updatedUser;
  } catch (error) {
    console.error("Error clearing user subscription data:", error);
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
  updateUserSubscriptionData,
  clearUserSubscriptionData,
};
