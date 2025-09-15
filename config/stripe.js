const stripe = require("stripe");

// For sandbox/testing, we'll use test keys instead of live keys
// Note: You should add these to your .env file
const stripeConfig = {
  // Use test keys for development/sandbox
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  secretKey: process.env.STRIPE_SECRET_KEY,

  // Webhook secret for verifying webhook events
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
};

// Initialize Stripe with secret key
const stripeInstance = stripe(stripeConfig.secretKey);

module.exports = {
  stripe: stripeInstance,
  stripeConfig,
};
