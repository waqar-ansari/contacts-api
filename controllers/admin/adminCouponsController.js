// controllers/admin/adminCouponsController.js
const Coupon = require("../../models/couponModel");

// @desc    Get all coupons
// @route   GET /api/admin/coupons
// @access  Private/SuperAdmin
const getAllCoupons = async (req, res) => {
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
      couponCode: couponCode.toUpperCase(),
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

    const coupon = new Coupon({
      name,
      couponCode: couponCode.toUpperCase(),
      discountType,
      discountValue,
      expiryDate,
      maxUsage: maxUsage || null,
      isActive,
      createdBy: req.user._id,
    });

    const savedCoupon = await coupon.save();
    await savedCoupon.populate("createdBy", "firstName lastName email");

    res.status(201).json({
      success: true,
      message: "Coupon created successfully",
      data: savedCoupon,
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

// @desc    Update coupon
// @route   PUT /api/admin/coupons/:id
// @access  Private/SuperAdmin
const updateCoupon = async (req, res) => {
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
    if (couponCode && couponCode.toUpperCase() !== coupon.couponCode) {
      const existingCoupon = await Coupon.findOne({
        couponCode: couponCode.toUpperCase(),
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

    // Update fields
    if (name) coupon.name = name;
    if (couponCode) coupon.couponCode = couponCode.toUpperCase();
    if (discountType) coupon.discountType = discountType;
    if (discountValue !== undefined) coupon.discountValue = discountValue;
    if (expiryDate) coupon.expiryDate = expiryDate;
    if (maxUsage !== undefined) coupon.maxUsage = maxUsage || null;
    if (isActive !== undefined) coupon.isActive = isActive;

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

    coupon.isActive = !coupon.isActive;
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
