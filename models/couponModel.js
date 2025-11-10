const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    couponCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    stripe_test_mode: {
      type: Boolean,
      default: false,
    },
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: function (value) {
          if (this.discountType === "percentage") {
            return value >= 0 && value <= 100;
          }
          return value >= 0;
        },
        message: "Percentage discount must be between 0 and 100",
      },
    },
    expiryDate: {
      type: Date,
      required: true,
      validate: {
        validator: function (value) {
          return value > new Date();
        },
        message: "Expiry date must be in the future",
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    maxUsage: {
      type: Number,
      default: null, // null means unlimited usage
      min: 1,
    },
    stripeCouponId: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple null values
      index: true,
    },
    stripePromotionCodeId: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple null values
      index: true,
    },
    usedByUsers: {
      type: [
        {
          userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
          usedAt: {
            type: Date,
            default: Date.now,
          },
          stripeCustomerId: String,
        },
      ],
      default: [],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
couponSchema.index({ couponCode: 1, isActive: 1 });
couponSchema.index({ expiryDate: 1 });

// Virtual to check if coupon is expired
couponSchema.virtual("isExpired").get(function () {
  return new Date() > this.expiryDate;
});

// Virtual to check if coupon is available for use
couponSchema.virtual("isAvailable").get(function () {
  if (!this.isActive || this.isExpired) {
    return false;
  }
  if (this.maxUsage && this.usageCount >= this.maxUsage) {
    return false;
  }
  return true;
});

// Method to increment usage count
couponSchema.methods.incrementUsage = function () {
  this.usageCount += 1;
  return this.save();
};

// Method to check if user has already used this coupon
couponSchema.methods.hasUserUsedCoupon = function (userId, stripeCustomerId) {
  return this.usedByUsers.some(
    (usage) =>
      (userId &&
        usage.userId &&
        usage.userId.toString() === userId.toString()) ||
      (stripeCustomerId && usage.stripeCustomerId === stripeCustomerId)
  );
};

// Method to mark coupon as used by a user
couponSchema.methods.markUsedByUser = function (userId, stripeCustomerId) {
  if (!this.hasUserUsedCoupon(userId, stripeCustomerId)) {
    this.usedByUsers.push({
      userId: userId || null,
      stripeCustomerId: stripeCustomerId || null,
      usedAt: new Date(),
    });
    this.usageCount += 1;
    return this.save();
  }
  return Promise.resolve(this);
};

module.exports = mongoose.model("Coupon", couponSchema);
