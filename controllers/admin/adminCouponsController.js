// controllers/admin/adminCouponsController.js
const Coupon = require("../../models/couponModel");
const {
  createStripeCoupon,
  updateStripeCoupon,
  deleteStripeCoupon,
  createStripePromotionCode,
  updateStripePromotionCode,
  deleteStripePromotionCode,
} = require("../../utils/stripeUtils");

// @desc    Get all coupons
// @route   GET /api/admin/coupons
// @access  Private/SuperAdmin
const getAllCoupons = async (req, res) => {
  const useTestMode = req.stripe_test_mode || false;

  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
      search = "",
      isActive,
      discountType,
    } = req.query;

    // Build filter object
    const filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { couponCode: { $regex: search, $options: "i" } },
      ];
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    if (discountType) {
      filter.discountType = discountType;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Execute query
    const coupons = await Coupon.find(filter)
      .populate("createdBy", "firstName lastName email")
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Coupon.countDocuments(filter);
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: coupons,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Get single coupon by ID
// @route   GET /api/admin/coupons/:id
// @access  Private/SuperAdmin
const getCouponById = async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid coupon ID format",
      });
    }

    const coupon = await Coupon.findById(req.params.id).populate(
      "createdBy",
      "firstName lastName email"
    );

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    res.json({
      success: true,
      data: coupon,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Create new coupon
// @route   POST /api/admin/coupons
// @access  Private/SuperAdmin
const createCoupon = async (req, res) => {
  const useTestMode = req.stripe_test_mode || false;
  try {
    const {
      name,
      couponCode,
      discountType,
      discountValue,
      expiryDate,
      maxUsage,
      isActive = true,
    } = req.body;

    // Validation
    if (
      !name ||
      !couponCode ||
      !discountType ||
      !discountValue ||
      !expiryDate
    ) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided",
        requiredFields: [
          "name",
          "couponCode",
          "discountType",
          "discountValue",
          "expiryDate",
        ],
      });
    }

    // Check if coupon code already exists
    const existingCoupon = await Coupon.findOne({
      couponCode: couponCode,
    });

    if (existingCoupon) {
      return res.status(400).json({
        success: false,
        message: "Coupon code already exists",
      });
    }

    // Validate discount value based on type
    if (
      discountType === "percentage" &&
      (discountValue < 0 || discountValue > 100)
    ) {
      return res.status(400).json({
        success: false,
        message: "Percentage discount must be between 0 and 100",
      });
    }

    if (discountValue < 0) {
      return res.status(400).json({
        success: false,
        message: "Discount value cannot be negative",
      });
    }

    // Validate expiry date
    if (new Date(expiryDate) <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "Expiry date must be in the future",
      });
    }

    let stripeCouponId = null;
    let stripePromotionCodeId = null;

    // Create Stripe coupon first
    try {
      const stripeCoupon = await createStripeCoupon(
        {
          couponCode: couponCode,
          discountType,
          discountValue,
          expiryDate,
          maxUsage,
          name,
        },
        useTestMode
      );
      stripeCouponId = stripeCoupon.id;
      console.log(`Created Stripe coupon: ${stripeCouponId}`);

      // Create Stripe promotion code for hosted checkout
      try {
        const stripePromotionCode = await createStripePromotionCode(
          stripeCouponId,
          couponCode,
          {
            active: isActive,
            max_redemptions: maxUsage || undefined,
          },
          useTestMode
        );
        stripePromotionCodeId = stripePromotionCode.id;
        console.log(`Created Stripe promotion code: ${stripePromotionCodeId}`);
      } catch (promoCodeError) {
        console.error("Stripe promotion code creation error:", promoCodeError);
        // If promotion code creation fails, clean up the coupon
        try {
          await deleteStripeCoupon(stripeCouponId, useTestMode);
        } catch (cleanupError) {
          console.error("Error cleaning up Stripe coupon:", cleanupError);
        }
        return res.status(500).json({
          success: false,
          message:
            "Failed to create Stripe promotion code: " + promoCodeError.message,
        });
      }
    } catch (stripeError) {
      console.error("Stripe coupon creation error:", stripeError);
      return res.status(500).json({
        success: false,
        message: "Failed to create Stripe coupon: " + stripeError.message,
      });
    }

    const coupon = new Coupon({
      name,
      couponCode: couponCode,
      discountType,
      discountValue,
      expiryDate,
      maxUsage: maxUsage || null,
      isActive,
      stripeCouponId,
      stripePromotionCodeId,
      createdBy: req.user._id,
    });

    try {
      const savedCoupon = await coupon.save();
      await savedCoupon.populate("createdBy", "firstName lastName email");

      res.status(201).json({
        success: true,
        message: "Coupon created successfully",
        data: savedCoupon,
      });
    } catch (dbError) {
      // If MongoDB save fails, clean up both Stripe coupon and promotion code
      if (stripeCouponId) {
        try {
          await deleteStripeCoupon(stripeCouponId, useTestMode);
          console.log(`Cleaned up Stripe coupon: ${stripeCouponId}`);
        } catch (cleanupError) {
          console.error("Error cleaning up Stripe coupon:", cleanupError);
        }
      }
      if (stripePromotionCodeId) {
        try {
          await deleteStripePromotionCode(stripePromotionCodeId, useTestMode);
          console.log(
            `Cleaned up Stripe promotion code: ${stripePromotionCodeId}`
          );
        } catch (cleanupError) {
          console.error(
            "Error cleaning up Stripe promotion code:",
            cleanupError
          );
        }
      }
      throw dbError;
    }
  } catch (error) {
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors,
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Update coupon
// @route   PUT /api/admin/coupons/:id
// @access  Private/SuperAdmin
const updateCoupon = async (req, res) => {
  const useTestMode = req.stripe_test_mode || false;
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid coupon ID format",
      });
    }

    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    const {
      name,
      couponCode,
      discountType,
      discountValue,
      expiryDate,
      maxUsage,
      isActive,
    } = req.body;

    // Check if coupon code is being changed and if it already exists
    if (couponCode && couponCode !== coupon.couponCode) {
      const existingCoupon = await Coupon.findOne({
        couponCode: couponCode,
        _id: { $ne: req.params.id },
      });

      if (existingCoupon) {
        return res.status(400).json({
          success: false,
          message: "Coupon code already exists",
        });
      }
    }

    // Validate discount value based on type
    if (
      discountType === "percentage" &&
      discountValue &&
      (discountValue < 0 || discountValue > 100)
    ) {
      return res.status(400).json({
        success: false,
        message: "Percentage discount must be between 0 and 100",
      });
    }

    if (discountValue && discountValue < 0) {
      return res.status(400).json({
        success: false,
        message: "Discount value cannot be negative",
      });
    }

    // Validate expiry date
    if (expiryDate && new Date(expiryDate) <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "Expiry date must be in the future",
      });
    }

    // Check if significant fields are being changed that require Stripe update
    const needsStripeUpdate =
      (couponCode && couponCode !== coupon.couponCode) ||
      (discountType && discountType !== coupon.discountType) ||
      (discountValue !== undefined && discountValue !== coupon.discountValue) ||
      (expiryDate &&
        new Date(expiryDate).getTime() !==
          new Date(coupon.expiryDate).getTime()) ||
      (maxUsage !== undefined && maxUsage !== coupon.maxUsage) ||
      (name && name !== coupon.name);

    let newStripeCouponId = coupon.stripeCouponId;
    let newStripePromotionCodeId = coupon.stripePromotionCodeId;

    // Handle Stripe coupon update if needed
    if (needsStripeUpdate) {
      try {
        const newStripeCoupon = await updateStripeCoupon(
          coupon.stripeCouponId,
          {
            couponCode: couponCode ? couponCode : coupon.couponCode,
            discountType: discountType || coupon.discountType,
            discountValue:
              discountValue !== undefined
                ? discountValue
                : coupon.discountValue,
            expiryDate: expiryDate || coupon.expiryDate,
            maxUsage: maxUsage !== undefined ? maxUsage : coupon.maxUsage,
            name: name || coupon.name,
          },
          useTestMode
        );
        newStripeCouponId = newStripeCoupon.id;
        console.log(`Updated Stripe coupon: ${newStripeCouponId}`);

        // Update promotion code with new coupon
        try {
          const newStripePromotionCode = await updateStripePromotionCode(
            coupon.stripePromotionCodeId,
            newStripeCouponId,
            couponCode ? couponCode : coupon.couponCode,
            {
              active: isActive !== undefined ? isActive : coupon.isActive,
              max_redemptions:
                (maxUsage !== undefined ? maxUsage : coupon.maxUsage) ||
                undefined,
            },
            useTestMode
          );
          newStripePromotionCodeId = newStripePromotionCode.id;
          console.log(
            `Updated Stripe promotion code: ${newStripePromotionCodeId}`
          );
        } catch (promoCodeError) {
          console.error("Stripe promotion code update error:", promoCodeError);
          // If promotion code update fails, clean up the new coupon and restore old one
          try {
            await deleteStripeCoupon(newStripeCouponId, useTestMode);
          } catch (cleanupError) {
            console.error("Error cleaning up new Stripe coupon:", cleanupError);
          }
          return res.status(500).json({
            success: false,
            message:
              "Failed to update Stripe promotion code: " +
              promoCodeError.message,
          });
        }
      } catch (stripeError) {
        console.error("Stripe coupon update error:", stripeError);
        return res.status(500).json({
          success: false,
          message: "Failed to update Stripe coupon: " + stripeError.message,
        });
      }
    } else if (isActive !== undefined && isActive !== coupon.isActive) {
      // If only status is changing, just update the promotion code status
      try {
        const updatedPromoCode = await updateStripePromotionCode(
          coupon.stripePromotionCodeId,
          coupon.stripeCouponId,
          coupon.couponCode,
          {
            active: isActive,
            max_redemptions: coupon.maxUsage || undefined,
          },
          useTestMode
        );
        newStripePromotionCodeId = updatedPromoCode.id;
        console.log(
          `Updated Stripe promotion code status: ${newStripePromotionCodeId}`
        );
      } catch (promoCodeError) {
        console.error(
          "Stripe promotion code status update error:",
          promoCodeError
        );
        return res.status(500).json({
          success: false,
          message:
            "Failed to update Stripe promotion code status: " +
            promoCodeError.message,
        });
      }
    }

    // Update fields
    if (name) coupon.name = name;
    if (couponCode) coupon.couponCode = couponCode;
    if (discountType) coupon.discountType = discountType;
    if (discountValue !== undefined) coupon.discountValue = discountValue;
    if (expiryDate) coupon.expiryDate = expiryDate;
    if (maxUsage !== undefined) coupon.maxUsage = maxUsage || null;
    if (isActive !== undefined) coupon.isActive = isActive;
    if (newStripeCouponId !== coupon.stripeCouponId)
      coupon.stripeCouponId = newStripeCouponId;
    if (newStripePromotionCodeId !== coupon.stripePromotionCodeId)
      coupon.stripePromotionCodeId = newStripePromotionCodeId;

    const updatedCoupon = await coupon.save();
    await updatedCoupon.populate("createdBy", "firstName lastName email");

    res.json({
      success: true,
      message: "Coupon updated successfully",
      data: updatedCoupon,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors,
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Delete coupon
// @route   DELETE /api/admin/coupons/:id
// @access  Private/SuperAdmin
const deleteCoupon = async (req, res) => {
  const useTestMode = req.stripe_test_mode || false;
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid coupon ID format",
      });
    }

    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    // Delete Stripe promotion code if it exists
    if (coupon.stripePromotionCodeId) {
      try {
        await deleteStripePromotionCode(coupon.stripePromotionCodeId, useTestMode);
        console.log(
          `Deleted Stripe promotion code: ${coupon.stripePromotionCodeId}`
        );
      } catch (stripeError) {
        console.error("Stripe promotion code deletion error:", stripeError);
        // Continue with coupon deletion even if promotion code deletion fails
      }
    }

    // Delete Stripe coupon if it exists
    if (coupon.stripeCouponId) {
      try {
        await deleteStripeCoupon(coupon.stripeCouponId, useTestMode);
        console.log(`Deleted Stripe coupon: ${coupon.stripeCouponId}`);
      } catch (stripeError) {
        console.error("Stripe coupon deletion error:", stripeError);
        // Continue with MongoDB deletion even if Stripe deletion fails
        // This handles cases where the Stripe coupon might have been deleted manually
      }
    }

    await Coupon.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Coupon deleted successfully",
      deletedCoupon: {
        id: coupon._id,
        name: coupon.name,
        couponCode: coupon.couponCode,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Toggle coupon status (activate/deactivate)
// @route   PATCH /api/admin/coupons/:id/status
// @access  Private/SuperAdmin
const toggleCouponStatus = async (req, res) => {
  const useTestMode = req.stripe_test_mode || false;
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid coupon ID format",
      });
    }

    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    const wasActive = coupon.isActive;
    coupon.isActive = !coupon.isActive;

    // Handle Stripe coupon status change
    try {
      if (coupon.isActive && !wasActive) {
        // Activating coupon - create Stripe coupon if it doesn't exist
        if (!coupon.stripeCouponId) {
          const stripeCoupon = await createStripeCoupon({
            couponCode: coupon.couponCode,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            expiryDate: coupon.expiryDate,
            maxUsage: coupon.maxUsage,
            name: coupon.name,
            mongoId: coupon._id.toString(),
          },useTestMode);
          coupon.stripeCouponId = stripeCoupon.id;
          console.log(
            `Created Stripe coupon on activation: ${stripeCoupon.id}`
          );

          // Create promotion code for the new coupon
          try {
            const stripePromotionCode = await createStripePromotionCode(
              stripeCoupon.id,
              coupon.couponCode,
              {
                active: true,
                max_redemptions: coupon.maxUsage || undefined,
              },
              useTestMode
            );
            coupon.stripePromotionCodeId = stripePromotionCode.id;
            console.log(
              `Created Stripe promotion code on activation: ${stripePromotionCode.id}`
            );
          } catch (promoCodeError) {
            console.error("Error creating promotion code:", promoCodeError);
            // Clean up the coupon if promotion code creation fails
            await deleteStripeCoupon(stripeCoupon.id, useTestMode);
            throw promoCodeError;
          }
        }
      } else if (!coupon.isActive && wasActive) {
        // Deactivating coupon - delete Stripe promotion code and coupon
        if (coupon.stripePromotionCodeId) {
          await deleteStripePromotionCode(coupon.stripePromotionCodeId, useTestMode);
          console.log(
            `Deleted Stripe promotion code on deactivation: ${coupon.stripePromotionCodeId}`
          );
          coupon.stripePromotionCodeId = null;
        }

        if (coupon.stripeCouponId) {
          await deleteStripeCoupon(coupon.stripeCouponId, useTestMode);
          console.log(
            `Deleted Stripe coupon on deactivation: ${coupon.stripeCouponId}`
          );
          coupon.stripeCouponId = null;
        }
      }
    } catch (stripeError) {
      console.error("Stripe coupon status change error:", stripeError);
      // Revert the status change if Stripe operation fails
      coupon.isActive = wasActive;
      return res.status(500).json({
        success: false,
        message:
          "Failed to update Stripe coupon status: " + stripeError.message,
      });
    }

    await coupon.save();
    await coupon.populate("createdBy", "firstName lastName email");

    res.json({
      success: true,
      message: `Coupon ${
        coupon.isActive ? "activated" : "deactivated"
      } successfully`,
      data: coupon,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Get coupon statistics
// @route   GET /api/admin/coupons/stats
// @access  Private/SuperAdmin
const getCouponStats = async (req, res) => {
  try {
    const totalCoupons = await Coupon.countDocuments();
    const activeCoupons = await Coupon.countDocuments({ isActive: true });
    const expiredCoupons = await Coupon.countDocuments({
      expiryDate: { $lt: new Date() },
    });
    const percentageCoupons = await Coupon.countDocuments({
      discountType: "percentage",
    });
    const fixedCoupons = await Coupon.countDocuments({ discountType: "fixed" });

    // Get most used coupons
    const mostUsedCoupons = await Coupon.find({ usageCount: { $gt: 0 } })
      .sort({ usageCount: -1 })
      .limit(5)
      .select("name couponCode usageCount discountType discountValue");

    res.json({
      success: true,
      data: {
        overview: {
          total: totalCoupons,
          active: activeCoupons,
          inactive: totalCoupons - activeCoupons,
          expired: expiredCoupons,
        },
        byType: {
          percentage: percentageCoupons,
          fixed: fixedCoupons,
        },
        mostUsed: mostUsedCoupons,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

module.exports = {
  getAllCoupons,
  getCouponById,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  toggleCouponStatus,
  getCouponStats,
};
