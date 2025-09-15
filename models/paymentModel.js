const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    // Payment identification
    paymentId: {
      type: String,
      unique: true,
      required: true,
      default: () =>
        `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    },

    // User and plan information
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      required: true,
    },

    // Payment details
    paymentMethod: {
      type: String,
      enum: ["credits", "stripe", "mixed"], // mixed = credits + stripe
      required: true,
    },

    // Amount breakdown (all amounts in cents)
    amounts: {
      totalAmount: { type: Number, required: true }, // Total plan cost
      creditUsed: { type: Number, default: 0 }, // Credits used
      stripeAmount: { type: Number, default: 0 }, // Amount charged to Stripe
      upgradeCost: { type: Number, default: 0 }, // Actual upgrade cost (after prorations)
      remainingValue: { type: Number, default: 0 }, // Value from previous plan
    },

    // Stripe specific data
    stripe: {
      paymentIntentId: String,
      paymentStatus: {
        type: String,
        enum: ["pending", "succeeded", "failed", "canceled"],
        default: "pending",
      },
      transactionId: String, // Stripe transaction ID
      failureReason: String,
    },

    // Payment context
    isUpgrade: { type: Boolean, default: false },
    isRenewal: { type: Boolean, default: false },
    isAutoRenewal: { type: Boolean, default: false },

    // Previous plan info (for upgrades)
    previousPlan: {
      planId: { type: mongoose.Schema.Types.ObjectId, ref: "Plan" },
      remainingDays: { type: Number, default: 0 },
      expiryDate: Date,
    },

    // New plan info
    newPlan: {
      activatedAt: { type: Date, required: true },
      expiresAt: Date, // null for lifetime plans
      autoRenewal: { type: Boolean, default: false },
    },

    // Payment status and timestamps
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded", "partial_refund"],
      default: "pending",
    },

    processedAt: Date,
    completedAt: Date,
    failedAt: Date,

    // Additional metadata
    metadata: {
      userAgent: String,
      ipAddress: String,
      currency: { type: String, default: "USD" },
      notes: String,
    },

    // Refund information
    refund: {
      refundId: String,
      refundAmount: Number,
      refundedAt: Date,
      reason: String,
    },
  },
  {
    timestamps: true,
    indexes: [
      { userId: 1, createdAt: -1 }, // For user payment history
      { planId: 1 }, // For plan analytics
      { "stripe.paymentIntentId": 1 }, // For Stripe webhook lookups
      { status: 1, createdAt: -1 }, // For admin queries
    ],
  }
);

// Virtual for formatted amounts in dollars
paymentSchema.virtual("formattedAmounts").get(function () {
  return {
    totalAmount: (this.amounts.totalAmount / 100).toFixed(2),
    creditUsed: (this.amounts.creditUsed / 100).toFixed(2),
    stripeAmount: (this.amounts.stripeAmount / 100).toFixed(2),
    upgradeCost: (this.amounts.upgradeCost / 100).toFixed(2),
    remainingValue: (this.amounts.remainingValue / 100).toFixed(2),
  };
});

// Instance method to mark payment as completed
paymentSchema.methods.markCompleted = function () {
  this.status = "completed";
  this.completedAt = new Date();
  if (this.stripe.paymentIntentId) {
    this.stripe.paymentStatus = "succeeded";
  }
  return this.save();
};

// Instance method to mark payment as failed
paymentSchema.methods.markFailed = function (reason) {
  this.status = "failed";
  this.failedAt = new Date();
  if (this.stripe.paymentIntentId) {
    this.stripe.paymentStatus = "failed";
    this.stripe.failureReason = reason;
  }
  return this.save();
};

// Static method to get user payment history
paymentSchema.statics.getUserPaymentHistory = function (userId, limit = 10) {
  return this.find({ userId })
    .populate("planId", "name price pricePeriod")
    .populate("previousPlan.planId", "name price")
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to get payment by Stripe payment intent
paymentSchema.statics.findByStripePaymentIntent = function (paymentIntentId) {
  return this.findOne({ "stripe.paymentIntentId": paymentIntentId })
    .populate("userId")
    .populate("planId");
};

module.exports = mongoose.model("Payment", paymentSchema);
