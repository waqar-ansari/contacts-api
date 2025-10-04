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
    console.log("Created new Stripe customer:", customer.id);
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
          console.log("Found existing Stripe customer:", customer.id);
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
    console.log("adding stripe credits ", customerId, amount);
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
 * Cancel ALL customer subscriptions regardless of status
 * @param {String} customerId - Stripe customer ID
 * @param {String} excludeSubscriptionId - Subscription ID to exclude from cancellation
 * @returns {Array} Array of cancellation results
 */
async function cancelAllCustomerSubscriptions(
  customerId,
  excludeSubscriptionId = null
) {
  try {
    // Get ALL subscriptions for the customer (regardless of status)
    const allSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all", // This gets all statuses: active, incomplete, trialing, past_due, canceled, etc.
    });

    // Get ALL subscription schedules for the customer
    const allSchedules = await stripe.subscriptionSchedules.list({
      customer: customerId,
    });

    const cancellationResults = [];

    // Handle regular subscriptions
    for (const subscription of allSubscriptions.data) {
      // Skip if this is the subscription we want to exclude
      if (excludeSubscriptionId && subscription.id === excludeSubscriptionId) {
        continue;
      }

      // Skip if already canceled
      if (subscription.status === "canceled") {
        console.log(
          `Subscription ${subscription.id} already canceled, skipping`
        );
        continue;
      }

      try {
        // Cancel immediately (not at period end)
        const canceledSubscription = await stripe.subscriptions.cancel(
          subscription.id
        );
        console.log(
          `Successfully canceled subscription: ${subscription.id} (was ${subscription.status})`
        );
        cancellationResults.push({
          id: subscription.id,
          status: "success",
          previousStatus: subscription.status,
          action: "canceled",
        });
      } catch (cancelError) {
        console.error(
          `Failed to cancel subscription ${subscription.id}:`,
          cancelError
        );
        cancellationResults.push({
          id: subscription.id,
          status: "error",
          error: cancelError.message,
          previousStatus: subscription.status,
        });
      }
    }

    // Handle subscription schedules
    for (const schedule of allSchedules.data) {
      // Skip if already canceled or completed
      if (schedule.status === "canceled" || schedule.status === "completed") {
        console.log(
          `Subscription schedule ${schedule.id} already ${schedule.status}, skipping`
        );
        continue;
      }

      try {
        // Cancel the subscription schedule
        const canceledSchedule = await stripe.subscriptionSchedules.cancel(
          schedule.id
        );
        console.log(
          `Successfully canceled subscription schedule: ${schedule.id} (was ${schedule.status})`
        );
        cancellationResults.push({
          id: schedule.id,
          status: "success",
          previousStatus: schedule.status,
          action: "schedule_canceled",
        });
      } catch (cancelError) {
        console.error(
          `Failed to cancel subscription schedule ${schedule.id}:`,
          cancelError
        );
        cancellationResults.push({
          id: schedule.id,
          status: "error",
          error: cancelError.message,
          previousStatus: schedule.status,
        });
      }
    }

    return cancellationResults;
  } catch (error) {
    console.error("Error canceling all customer subscriptions:", error);
    throw error;
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
      activatedAt: new Date(
        subscription.items.data[0].current_period_start * 1000 || null
      ),
      expiresAt: new Date(
        subscription.items.data[0].current_period_end * 1000 || null
      ),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      cancelAt: subscription.cancel_at
        ? new Date(subscription.cancel_at * 1000)
        : null,
      canceledAt: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000)
        : null,
      isScheduledToCancel: !!subscription.cancel_at,
      isCanceled:
        !!subscription.canceled_at || subscription.status === "canceled",
      trialStart: subscription.trial_start
        ? new Date(subscription.trial_start * 1000)
        : null,
      trialEnd: subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null,
      priceId: subscription.items.data[0]?.price?.id || subscription.plan?.id,
      amount:
        subscription.items.data[0]?.price?.unit_amount ||
        subscription.plan?.amount,
      currency:
        subscription.items.data[0]?.price?.currency ||
        subscription.plan?.currency ||
        subscription.currency,
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
    // First, check if customer has payment methods
    const hasPaymentMethod = await customerHasPaymentMethod(customerId);
    if (!hasPaymentMethod) {
      throw new Error(
        "User must have a payment method to be assigned a premium plan"
      );
    }

    // Create new subscription with immediate payment
    const newSubscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: newPriceId }],
      payment_behavior: "error_if_incomplete", // Require immediate payment
      payment_settings: {
        save_default_payment_method: "on_subscription",
      },
      metadata: {
        adminUpdate: "true",
        adminAssigned: new Date().toISOString(),
      },
    });

    // If new subscription was created successfully, cancel ALL other subscriptions
    if (newSubscription && newSubscription.status === "active") {
      const cancellationResults = await cancelAllCustomerSubscriptions(
        customerId,
        newSubscription.id // Exclude the new subscription from cancellation
      );

      console.log(
        `Cancelled ${cancellationResults.length} subscriptions/schedules for customer ${customerId}`
      );
      cancellationResults.forEach((result) => {
        if (result.status === "success") {
          const actionText =
            result.action === "schedule_canceled"
              ? "Cancelled schedule"
              : "Cancelled subscription";
          console.log(
            `✓ ${actionText} ${result.id} (was ${result.previousStatus})`
          );
        } else {
          console.log(
            `✗ Failed to cancel subscription/schedule ${result.id}: ${result.error}`
          );
        }
      });
    }

    return newSubscription;
  } catch (error) {
    console.error("Error updating subscription by admin:", error);
    throw error;
  }
}

/**
 * Get user's billing history including invoices and subscriptions
 * @param {String} customerId - Stripe customer ID
 * @param {Object} options - Options for filtering (limit, starting_after, etc.)
 * @returns {Object} Billing history data
 */
async function getUserBillingHistory(customerId, options = {}) {
  try {
    const limit = options.limit || 50;

    // Get invoices (past and upcoming)
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit: limit,
      ...options,
    });

    // Get all subscriptions (active, canceled, past)
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: limit,
    });

    // Get upcoming invoice if exists
    let upcomingInvoice = null;
    try {
      upcomingInvoice = await stripe.invoices.retrieveUpcoming({
        customer: customerId,
      });
    } catch (error) {
      // No upcoming invoice is fine
      console.log("No upcoming invoice found");
    }

    return {
      invoices: invoices.data,
      subscriptions: subscriptions.data,
      upcomingInvoice,
      hasMore: invoices.has_more,
    };
  } catch (error) {
    console.error("Error getting user billing history:", error);
    throw error;
  }
}

/**
 * Get formatted billing history for display
 * @param {String} customerId - Stripe customer ID
 * @returns {Array} Formatted billing history items
 */
async function getFormattedBillingHistory(customerId) {
  try {
    const billingData = await getUserBillingHistory(customerId);
    const historyItems = [];

    // Process past invoices only
    billingData.invoices.forEach((invoice) => {
      const item = {
        id: invoice.id,
        date: new Date(invoice.created * 1000),
        description: getInvoiceDescription(invoice),
        amount: invoice.total,
        currency: invoice.currency,
        status: invoice.status,
        pdfUrl: invoice.invoice_pdf,
        hostedUrl: invoice.hosted_invoice_url,
        subscriptionId: invoice.subscription,
        periodStart: invoice.period_start
          ? new Date(invoice.period_start * 1000)
          : null,
        periodEnd: invoice.period_end
          ? new Date(invoice.period_end * 1000)
          : null,
        paid: invoice.paid,
        paymentMethod: getPaymentMethodFromInvoice(invoice),
        invoiceNumber: invoice.number,
      };
      historyItems.push(item);
    });

    // Process upcoming invoice only if it exists
    if (billingData.upcomingInvoice) {
      const upcoming = billingData.upcomingInvoice;
      const item = {
        id: upcoming.id || `upcoming-${Date.now()}`,
        date: new Date(upcoming.period_end * 1000),
        description: getInvoiceDescription(upcoming),
        amount: upcoming.total,
        currency: upcoming.currency,
        status: "upcoming",
        subscriptionId: upcoming.subscription,
        periodStart: new Date(upcoming.period_start * 1000),
        periodEnd: new Date(upcoming.period_end * 1000),
        paid: false,
        invoiceNumber: null,
      };
      historyItems.push(item);
    }

    // Sort by date (newest first)
    historyItems.sort((a, b) => b.date - a.date);

    return historyItems;
  } catch (error) {
    console.error("Error getting formatted billing history:", error);
    throw error;
  }
}

/**
 * Get description for invoice
 * @param {Object} invoice - Stripe invoice object
 * @returns {String} Invoice description
 */
function getInvoiceDescription(invoice) {
  if (invoice.lines && invoice.lines.data.length > 0) {
    const line = invoice.lines.data[0];
    if (line.description) {
      return line.description;
    }
    if (line.price && line.price.nickname) {
      return `${line.price.nickname} subscription`;
    }
    if (line.plan && line.plan.nickname) {
      return `${line.plan.nickname} subscription`;
    }
  }

  return `Invoice ${invoice.number || invoice.id}`;
}

/**
 * Get payment method info from invoice
 * @param {Object} invoice - Stripe invoice object
 * @returns {Object} Payment method info
 */
function getPaymentMethodFromInvoice(invoice) {
  if (invoice.charge && invoice.charge.payment_method_details) {
    const pm = invoice.charge.payment_method_details;
    if (pm.card) {
      return {
        type: "card",
        brand: pm.card.brand,
        last4: pm.card.last4,
      };
    }
  }

  if (invoice.default_payment_method) {
    return {
      type: "payment_method",
      id: invoice.default_payment_method,
    };
  }

  return {
    type: "unknown",
  };
}

/**
 * Check if user has a trialing subscription
 * @param {String} customerId - Stripe customer ID
 * @returns {Object|null} Trialing subscription object or null
 */
async function getCustomerTrialingSubscription(customerId) {
  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "trialing",
    });

    if (subscriptions.data.length > 0) {
      // Return the most recently created trialing subscription
      return subscriptions.data.sort((a, b) => b.created - a.created)[0];
    }

    return null;
  } catch (error) {
    console.error("Error getting customer trialing subscription:", error);
    return null;
  }
}

/**
 * Delete/cancel a trialing subscription
 * @param {String} subscriptionId - Stripe subscription ID
 * @returns {Object|null} Cancelled subscription object or null
 */
async function deleteTrialingSubscription(subscriptionId) {
  try {
    // Get subscription first to verify it's trialing
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    if (subscription.status !== "trialing") {
      console.log(
        `Subscription ${subscriptionId} is not trialing (status: ${subscription.status}), skipping deletion`
      );
      return null;
    }

    // Cancel trialing subscription immediately
    const cancelledSubscription = await stripe.subscriptions.cancel(
      subscriptionId
    );
    console.log(
      `Successfully cancelled trialing subscription: ${subscriptionId}`
    );

    return cancelledSubscription;
  } catch (error) {
    console.error("Error deleting trialing subscription:", error);
    throw error;
  }
}

/**
 * Check if customer has active non-trialing subscription
 * @param {String} customerId - Stripe customer ID
 * @returns {Object|null} Active non-trialing subscription object or null
 */
async function getCustomerActiveNonTrialingSubscription(customerId) {
  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
    });

    // Filter for active or past_due subscriptions (excluding trialing)
    const activeNonTrialingSubscriptions = subscriptions.data.filter(
      (sub) => sub.status === "active" || sub.status === "past_due"
    );

    if (activeNonTrialingSubscriptions.length === 0) {
      return null;
    }

    // Return the most recently created active non-trialing subscription
    return activeNonTrialingSubscriptions.sort(
      (a, b) => b.created - a.created
    )[0];
  } catch (error) {
    console.error(
      "Error getting customer active non-trialing subscription:",
      error
    );
    return null;
  }
}

/**
 * Create a Stripe coupon
 * @param {Object} couponData - Coupon data
 * @returns {Object} Stripe coupon object
 */
async function createStripeCoupon(couponData) {
  try {
    const {
      couponCode,
      discountType,
      discountValue,
      expiryDate,
      maxUsage,
      name,
    } = couponData;

    console.log(`Creating Stripe coupon with original code: ${couponCode}`);

    const stripeCouponData = {
      id: couponCode.toLowerCase().replace(/[^a-z0-9_-]/g, "_"), // Make Stripe-compliant ID
      name: name,
      duration: "once", // We'll use 'once' as default since we handle expiry ourselves
    };

    console.log(`Stripe coupon ID will be: ${stripeCouponData.id}`);

    // Set discount type and value
    if (discountType === "percentage") {
      stripeCouponData.percent_off = discountValue;
    } else if (discountType === "fixed") {
      stripeCouponData.amount_off = Math.round(discountValue * 100); // Convert to cents
      stripeCouponData.currency = "usd";
    }

    // Set expiry date if provided
    if (expiryDate) {
      stripeCouponData.redeem_by = Math.floor(
        new Date(expiryDate).getTime() / 1000
      );
    }

    // Set max redemptions if provided
    if (maxUsage && maxUsage > 0) {
      stripeCouponData.max_redemptions = maxUsage;
    }

    // Add metadata
    stripeCouponData.metadata = {
      createdBy: "admin-panel",
      mongoId: couponData.mongoId || "",
      originalCouponCode: couponCode, // Store original code for reference
    };

    const stripeCoupon = await stripe.coupons.create(stripeCouponData);
    console.log(
      `Created Stripe coupon: ${stripeCoupon.id} for original code: ${couponCode}`
    );
    return stripeCoupon;
  } catch (error) {
    console.error("Error creating Stripe coupon:", error);
    throw error;
  }
}

/**
 * Update a Stripe coupon (creates new one since Stripe coupons are immutable)
 * @param {String} oldCouponId - Old Stripe coupon ID to delete
 * @param {Object} couponData - New coupon data
 * @returns {Object} New Stripe coupon object
 */
async function updateStripeCoupon(oldCouponId, couponData) {
  try {
    // Delete old coupon first
    if (oldCouponId) {
      await deleteStripeCoupon(oldCouponId);
    }

    // Create new coupon with updated data
    return await createStripeCoupon(couponData);
  } catch (error) {
    console.error("Error updating Stripe coupon:", error);
    throw error;
  }
}

/**
 * Delete a Stripe coupon
 * @param {String} couponId - Stripe coupon ID
 * @returns {Object} Deleted Stripe coupon object
 */
async function deleteStripeCoupon(couponId) {
  try {
    const deletedCoupon = await stripe.coupons.del(couponId);
    console.log("Deleted Stripe coupon:", couponId);
    return deletedCoupon;
  } catch (error) {
    console.error("Error deleting Stripe coupon:", error);
    throw error;
  }
}

/**
 * Retrieve a Stripe coupon
 * @param {String} couponId - Stripe coupon ID
 * @returns {Object} Stripe coupon object
 */
async function getStripeCoupon(couponId) {
  try {
    const coupon = await stripe.coupons.retrieve(couponId);
    return coupon;
  } catch (error) {
    console.error("Error retrieving Stripe coupon:", error);
    throw error;
  }
}

/**
 * List all Stripe coupons
 * @param {Object} options - Options for filtering (limit, starting_after, etc.)
 * @returns {Object} List of Stripe coupons
 */
async function listStripeCoupons(options = {}) {
  try {
    const coupons = await stripe.coupons.list(options);
    return coupons;
  } catch (error) {
    console.error("Error listing Stripe coupons:", error);
    throw error;
  }
}

/**
 * Create a Stripe promotion code for a coupon
 * @param {String} couponId - Stripe coupon ID
 * @param {String} promoCode - Promotion code (usually same as coupon code)
 * @param {Object} options - Additional options for promotion code
 * @returns {Object} Stripe promotion code object
 */
async function createStripePromotionCode(couponId, promoCode, options = {}) {
  try {
    console.log(`Creating promotion code with params:`, {
      couponId,
      promoCode,
      options,
    });

    const promotionCodeData = {
      coupon: couponId,
      code: promoCode,
      active: true,
      metadata: {
        createdBy: "admin-panel",
        couponId: couponId,
      },
      ...options,
    };

    console.log(`Promotion code data being sent to Stripe:`, promotionCodeData);

    const promotionCode = await stripe.promotionCodes.create(promotionCodeData);
    console.log(
      `Created Stripe promotion code: ${promotionCode.code} (ID: ${promotionCode.id}) for coupon: ${couponId}`
    );
    return promotionCode;
  } catch (error) {
    console.error("Error creating Stripe promotion code:", error);
    throw error;
  }
}

/**
 * Update a Stripe promotion code (deactivate old, create new)
 * @param {String} oldPromoCodeId - Old promotion code ID to deactivate
 * @param {String} couponId - Stripe coupon ID
 * @param {String} promoCode - New promotion code
 * @param {Object} options - Additional options
 * @returns {Object} New promotion code object
 */
async function updateStripePromotionCode(
  oldPromoCodeId,
  couponId,
  promoCode,
  options = {}
) {
  try {
    // Deactivate old promotion code if it exists
    if (oldPromoCodeId) {
      try {
        await stripe.promotionCodes.update(oldPromoCodeId, { active: false });
        console.log("Deactivated old promotion code:", oldPromoCodeId);
      } catch (error) {
        console.error("Error deactivating old promotion code:", error);
        // Continue with creating new one
      }
    }

    // Create new promotion code
    return await createStripePromotionCode(couponId, promoCode, options);
  } catch (error) {
    console.error("Error updating Stripe promotion code:", error);
    throw error;
  }
}

/**
 * Delete/Deactivate a Stripe promotion code
 * @param {String} promoCodeId - Promotion code ID
 * @returns {Object} Updated promotion code object
 */
async function deleteStripePromotionCode(promoCodeId) {
  try {
    const deactivatedPromoCode = await stripe.promotionCodes.update(
      promoCodeId,
      {
        active: false,
      }
    );
    console.log("Deactivated Stripe promotion code:", promoCodeId);
    return deactivatedPromoCode;
  } catch (error) {
    console.error("Error deactivating Stripe promotion code:", error);
    throw error;
  }
}

/**
 * Validate and get coupon from both MongoDB and Stripe
 * @param {String} couponCode - Coupon code to validate
 * @returns {Object} Validation result with coupon data
 */
async function validateCoupon(couponCode) {
  try {
    const Coupon = require("../models/couponModel");

    // Check MongoDB first
    const mongoCoupon = await Coupon.findOne({
      couponCode: couponCode,
    });

    if (!mongoCoupon) {
      return {
        isValid: false,
        error: "Coupon not found",
        coupon: null,
      };
    }

    // Check if coupon is active
    if (!mongoCoupon.isActive) {
      return {
        isValid: false,
        error: "Coupon is not active",
        coupon: null,
      };
    }

    // Check if coupon is expired
    if (mongoCoupon.isExpired) {
      return {
        isValid: false,
        error: "Coupon has expired",
        coupon: null,
      };
    }

    // Check if coupon has reached usage limit
    if (!mongoCoupon.isAvailable) {
      return {
        isValid: false,
        error: "Coupon usage limit reached",
        coupon: null,
      };
    }

    // Validate with Stripe if stripeCouponId exists
    if (mongoCoupon.stripeCouponId) {
      try {
        const stripeCoupon = await getStripeCoupon(mongoCoupon.stripeCouponId);
        if (!stripeCoupon || stripeCoupon.valid === false) {
          return {
            isValid: false,
            error: "Coupon is not valid in payment system",
            coupon: null,
          };
        }

        // Check Stripe-specific validations
        if (
          stripeCoupon.max_redemptions &&
          stripeCoupon.times_redeemed >= stripeCoupon.max_redemptions
        ) {
          return {
            isValid: false,
            error: "Coupon usage limit reached",
            coupon: null,
          };
        }

        if (
          stripeCoupon.redeem_by &&
          new Date() > new Date(stripeCoupon.redeem_by * 1000)
        ) {
          return {
            isValid: false,
            error: "Coupon has expired",
            coupon: null,
          };
        }
      } catch (stripeError) {
        console.error("Error validating Stripe coupon:", stripeError);
        return {
          isValid: false,
          error: "Error validating coupon",
          coupon: null,
        };
      }
    }

    return {
      isValid: true,
      error: null,
      coupon: {
        _id: mongoCoupon._id,
        name: mongoCoupon.name,
        couponCode: mongoCoupon.couponCode,
        discountType: mongoCoupon.discountType,
        discountValue: mongoCoupon.discountValue,
        stripeCouponId: mongoCoupon.stripeCouponId,
        expiryDate: mongoCoupon.expiryDate,
        maxUsage: mongoCoupon.maxUsage,
        usageCount: mongoCoupon.usageCount,
      },
    };
  } catch (error) {
    console.error("Error validating coupon:", error);
    return {
      isValid: false,
      error: "Error validating coupon",
      coupon: null,
    };
  }
}

/**
 * Calculate discount amount for a given subtotal and coupon
 * @param {Number} subtotal - Subtotal amount in cents
 * @param {Object} coupon - Coupon object from MongoDB
 * @returns {Object} Discount calculation result
 */
function calculateCouponDiscount(subtotal, coupon) {
  try {
    let discountAmount = 0;

    if (coupon.discountType === "percentage") {
      discountAmount = Math.round((subtotal * coupon.discountValue) / 100);
    } else if (coupon.discountType === "fixed") {
      // Convert fixed discount to cents if it's in dollars
      const fixedAmountInCents =
        coupon.discountValue > 100
          ? coupon.discountValue
          : Math.round(coupon.discountValue * 100);
      discountAmount = Math.min(fixedAmountInCents, subtotal);
    }

    const finalAmount = Math.max(0, subtotal - discountAmount);

    return {
      subtotal,
      discountAmount,
      finalAmount,
      discountPercentage:
        subtotal > 0 ? Math.round((discountAmount / subtotal) * 100) : 0,
      couponCode: coupon.couponCode,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
    };
  } catch (error) {
    console.error("Error calculating coupon discount:", error);
    return {
      subtotal,
      discountAmount: 0,
      finalAmount: subtotal,
      discountPercentage: 0,
      error: "Error calculating discount",
    };
  }
}

/**
 * Check if user has made their first purchase (excluding the free trial $0 invoice)
 * @param {String} customerId - Stripe customer ID
 * @returns {Boolean} True if user has made their first purchase
 */
async function hasUserMadeFirstPurchase(customerId) {
  try {
    if (!customerId) {
      return false;
    }

    // Get all invoices for the customer
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit: 100, // Should be enough for most cases
    });

    // Count invoices that are not free trial ($0 invoices)
    const paidInvoices = invoices.data.filter(
      (invoice) => invoice.amount_paid > 0
    );
    console.log(
      `Customer ${customerId} has ${paidInvoices.length} paid invoices`
    );
    // User has made first purchase if they have more than 0 paid invoices
    return paidInvoices.length > 0;
  } catch (error) {
    console.error("Error checking if user made first purchase:", error);
    return false;
  }
}

/**
 * Transfer cache_credits to Stripe credits and reset cache to 0
 * @param {Object} user - User object with cache_credits
 * @returns {Object} Result of the transfer operation
 */
async function transferCacheCreditsToStripe(user) {
  try {
    if (!user.cache_credits || user.cache_credits <= 0) {
      return {
        success: true,
        message: "No cache credits to transfer",
        transferred: 0,
      };
    }

    // Get or create Stripe customer
    const customer = await getOrCreateStripeCustomer(user);

    // Convert cache_credits (assumed to be in dollars) to cents
    const creditsInCents = Math.round(user.cache_credits * 100);

    // Add credits to Stripe
    await addStripeCredits(
      customer.id,
      creditsInCents,
      "Referral bonus credits applied after first purchase"
    );

    // Reset cache_credits to 0 in database
    await User.findByIdAndUpdate(user._id, {
      cache_credits: 0,
    });

    console.log(
      `Transferred $${user.cache_credits} from cache to Stripe credits for user ${user._id}`
    );

    return {
      success: true,
      message: `Transferred $${user.cache_credits} to your account credits`,
      transferred: user.cache_credits,
    };
  } catch (error) {
    console.error("Error transferring cache credits to Stripe:", error);
    return {
      success: false,
      message: "Failed to transfer cache credits",
      error: error.message,
    };
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
  getCustomerActiveNonTrialingSubscription,
  getCustomerTrialingSubscription,
  deleteTrialingSubscription,
  getPlanFromPriceId,
  getUserCurrentPlan,
  getUserBillingHistory,
  getFormattedBillingHistory,
  cancelAllCustomerSubscriptions,
  // Coupon functions
  createStripeCoupon,
  updateStripeCoupon,
  deleteStripeCoupon,
  getStripeCoupon,
  listStripeCoupons,
  validateCoupon,
  calculateCouponDiscount,
  // Promotion code functions
  createStripePromotionCode,
  updateStripePromotionCode,
  deleteStripePromotionCode,
  // Cache credits functions
  hasUserMadeFirstPurchase,
  transferCacheCreditsToStripe,
};
