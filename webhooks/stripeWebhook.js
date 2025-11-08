const { stripe, stripeTest } = require("../config/stripe");
const {
  processSubscriptionCompletion,
} = require("../utils/subscriptionProcessor");

/**
 * Handle Stripe webhook events
 * This webhook specifically handles checkout.session.completed events to ensure
 * subscription completion logic runs even if the user doesn't reach PaymentSuccess page
 */
const handleStripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const webhookSecretTest = process.env.STRIPE_WEBHOOK_SECRET_TEST;

  if (!webhookSecret && !webhookSecretTest) {
    console.error("Stripe webhook secret not configured");
    return res.status(500).json({
      success: false,
      message: "Webhook secret not configured",
    });
  }

  let event;
  let useTestMode = false;

  try {
    // Try to verify with test webhook secret first if available
    if (webhookSecretTest) {
      try {
        event = stripeTest.webhooks.constructEvent(
          req.body,
          sig,
          webhookSecretTest
        );
        useTestMode = true;
        console.log("✅ Webhook signature verified (TEST MODE)");
      } catch (testErr) {
        // If test verification fails, try production
        if (webhookSecret) {
          event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
          useTestMode = false;
          console.log("✅ Webhook signature verified (PRODUCTION MODE)");
        } else {
          throw testErr;
        }
      }
    } else {
      // Only production webhook secret available
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      useTestMode = false;
      console.log("✅ Webhook signature verified (PRODUCTION MODE)");
    }

    // Double-check using event.livemode property
    // event.livemode = false means test mode, true means production
    const eventIsTestMode = !event.livemode;
    if (eventIsTestMode !== useTestMode) {
      console.warn(
        `⚠️ Mode mismatch detected. Event livemode: ${event.livemode}, Using test mode: ${useTestMode}`
      );
      useTestMode = eventIsTestMode;
    }
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object, useTestMode);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error("Error handling webhook:", error);
    res.status(500).json({
      success: false,
      message: "Webhook handler error",
      error: error.message,
    });
  }
};

/**
 * Handle checkout.session.completed event
 * This ensures subscription completion logic runs even if user doesn't reach PaymentSuccess page
 */
const handleCheckoutSessionCompleted = async (session, useTestMode = false) => {
  console.log(
    `🔔 Processing checkout.session.completed webhook: ${session.id} (${
      useTestMode ? "TEST" : "PRODUCTION"
    } mode)`
  );

  try {
    // Use the centralized subscription processing function
    const result = await processSubscriptionCompletion(session.id, {
      fromWebhook: true,
      useTestMode,
    });

    if (result.alreadyProcessed) {
      console.log("⏭️ Session already processed by API endpoint");
    } else {
      console.log("✅ Webhook processing completed successfully");
    }
  } catch (error) {
    console.error("❌ Error in handleCheckoutSessionCompleted:", error);
    throw error; // Re-throw to trigger webhook retry
  }
};

module.exports = {
  handleStripeWebhook,
};
