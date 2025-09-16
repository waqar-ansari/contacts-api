// models/Plan.js
const mongoose = require("mongoose");

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
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

    features: [
      {
        text: { type: String, required: true },
        isAvailable: { type: Boolean, default: true },
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

module.exports = mongoose.model("Plan", planSchema);
