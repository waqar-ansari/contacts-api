// controllers/couponController.js
const {
  validateCoupon,
  calculateCouponDiscount,
} = require("../utils/stripeUtils");

/**
 * Validate a coupon code for user payments
 * @route POST /api/user/payment/validate-coupon
 * @access Private
 */
const validateCouponCode = async (req, res) => {
  try {
    const { couponCode } = req.body;
    const useTestMode = req.user.stripe_test_mode || false;

    if (!couponCode || typeof couponCode !== "string") {
      return res.status(400).json({
        success: false,
        message: "Coupon code is required",
      });
    }

    const validation = await validateCoupon(couponCode.trim(), useTestMode);

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.error,
        isValid: false,
      });
    }

    res.json({
      success: true,
      message: "Coupon is valid",
      isValid: true,
      coupon: {
        name: validation.coupon.name,
        couponCode: validation.coupon.couponCode,
        discountType: validation.coupon.discountType,
        discountValue: validation.coupon.discountValue,
        expiryDate: validation.coupon.expiryDate,
        maxUsage: validation.coupon.maxUsage,
        usageCount: validation.coupon.usageCount,
        remainingUses: validation.coupon.maxUsage
          ? validation.coupon.maxUsage - validation.coupon.usageCount
          : null,
      },
    });
  } catch (error) {
    console.error("Error validating coupon:", error);
    res.status(500).json({
      success: false,
      message: "Failed to validate coupon",
      error: error.message,
    });
  }
};

/**
 * Calculate discount preview for a given amount and coupon
 * @route POST /api/user/payment/preview-coupon-discount
 * @access Private
 */
const previewCouponDiscount = async (req, res) => {
  try {
    const { couponCode, amount } = req.body;
    const useTestMode = req.user.stripe_test_mode || false;
    if (!couponCode || typeof couponCode !== "string") {
      return res.status(400).json({
        success: false,
        message: "Coupon code is required",
      });
    }

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid amount is required",
      });
    }

    const validation = await validateCoupon(couponCode.trim(), useTestMode);

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.error,
        isValid: false,
      });
    }

    // Calculate discount (amount should be in cents)
    const amountInCents = Math.round(amount * 100);
    const discountCalculation = calculateCouponDiscount(
      amountInCents,
      validation.coupon
    );

    res.json({
      success: true,
      message: "Discount Calculated",
      isValid: true,
      coupon: {
        name: validation.coupon.name,
        couponCode: validation.coupon.couponCode,
        discountType: validation.coupon.discountType,
        discountValue: validation.coupon.discountValue,
      },
      discount: {
        subtotal: discountCalculation.subtotal / 100, // Convert back to dollars
        discountAmount: discountCalculation.discountAmount / 100,
        finalAmount: discountCalculation.finalAmount / 100,
        discountPercentage: discountCalculation.discountPercentage,
        savings: discountCalculation.discountAmount / 100,
      },
    });
  } catch (error) {
    console.error("Error calculating coupon discount:", error);
    res.status(500).json({
      success: false,
      message: "Failed to calculate discount",
      error: error.message,
    });
  }
};

module.exports = {
  validateCouponCode,
  previewCouponDiscount,
};
