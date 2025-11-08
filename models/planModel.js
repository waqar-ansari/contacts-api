// models/Plan.js
const mongoose = require("mongoose");

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    price: {
      ////in cents/fils
      type: Number,
      required: true,
    },
    pricePeriod: {
      type: String,
      enum: ["month", "year", "lifetime"],
      default: "month",
    },
    description: {
      type: String,
      required: true,
    },

    // Stripe integration fields
    stripePriceId: {
      type: String,
      sparse: true, // Allow null/undefined but ensure uniqueness when present
    },
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

module.exports = mongoose.model("Plan", planSchema);
