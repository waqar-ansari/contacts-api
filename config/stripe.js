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

const stripeConfigTest = {
  // Use test keys for development/sandbox
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY_TEST,
  secretKey: process.env.STRIPE_SECRET_KEY_TEST,

  // Webhook secret for verifying webhook events
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET_TEST,
};

// Initialize Stripe with secret key
const stripeInstance = stripe(stripeConfig.secretKey);
const stripeTestInstance = stripe(stripeConfigTest.secretKey);

module.exports = {
  stripe: stripeInstance,
  stripeTest: stripeTestInstance,
  stripeConfig,
};
