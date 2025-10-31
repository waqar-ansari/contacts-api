const mongoose = require("mongoose");

// Simplified Plan model for cron job
const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    price: {
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
    stripePriceId: {
      type: String,
      sparse: true,
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
