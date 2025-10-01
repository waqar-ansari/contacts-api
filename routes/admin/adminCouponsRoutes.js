// routes/admin/adminCouponsRoutes.js
const express = require("express");
const router = express.Router();
const {
  getAllCoupons,
  getCouponById,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  toggleCouponStatus,
  getCouponStats,
} = require("../../controllers/admin/adminCouponsController");

// GET coupon statistics
router.get("/stats", getCouponStats);

// GET all coupons
router.get("/", getAllCoupons);

// GET single coupon by ID
router.get("/:id", getCouponById);

// CREATE new coupon
router.post("/", createCoupon);

// UPDATE coupon
router.put("/:id", updateCoupon);

// DELETE coupon
router.delete("/:id", deleteCoupon);

// TOGGLE coupon status
router.patch("/:id/status", toggleCouponStatus);

module.exports = router;
