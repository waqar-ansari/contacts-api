// models/Plan.js
const mongoose = require("mongoose");

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      enum: ["Starter", "Pro", "Business", "Enterprise"],
    },
    price: {
      ////in cents/fils
      type: Number,
      required: true,
    },
    pricePeriod: {
      type: String,
      enum: ["month", "year", "lifetime", "custom"],
      default: "month",
    },
    description: {
      type: String,
      required: true,
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
