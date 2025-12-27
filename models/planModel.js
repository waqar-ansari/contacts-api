// models/Plan.js
const mongoose = require("mongoose");

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },

    // Stripe integration fields
    stripePriceIds: [
      {
        priceId: {
          type: String,
          required: true,
        },
        billingPeriod: {
          type: String,
          enum: ["week", "month", "year"],
          required: true,
        },
        // Price stored in cents/fils for reference (actual source of truth is Stripe)
        price: {
          type: Number,
          required: true,
        },
      },
    ],
    stripeProductId: {
      type: String,
      sparse: true,
    },
    stripe_test_mode: {
      type: Boolean,
      default: false,
    },

    features: [
      {
        text: { type: String, required: true },
        isAvailable: { type: Boolean, default: true },
        order: { type: Number, default: 0 },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },

    isPopular: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to allow same plan name in test and live modes
planSchema.index({ name: 1, stripe_test_mode: 1 }, { unique: true });

// Validation: Ensure at least one price ID and unique billing periods
planSchema.pre("save", function (next) {
  if (!this.stripePriceIds || this.stripePriceIds.length === 0) {
    return next(new Error("At least one billing period is required"));
  }

  // Check for duplicate billing periods
  const periods = this.stripePriceIds.map((p) => p.billingPeriod);
  const uniquePeriods = new Set(periods);
  if (periods.length !== uniquePeriods.size) {
    return next(new Error("Duplicate billing periods are not allowed"));
  }

  next();
});

module.exports = mongoose.model("Plan", planSchema);
