const express = require("express");
const router = express.Router();
const multer = require("multer");

const storage = multer.memoryStorage();
const upload = multer({ storage });
const {
  getAllUsers,
  getUser,
  editProfile,
  getAllPlans,
  getUsersCount,
  getUserPaymentMethods,
  getUserBillingHistory,
  getUserPaymentMethodsDetailed,
  deleteUserPaymentMethod,
} = require("../../controllers/admin/adminUserController");

router.get("/", getAllUsers);
router.get("/count", getUsersCount); // ✅ get total users count excluding superadmin
router.get("/plans", getAllPlans); // ✅ get all plans for dropdown
router.get("/:id", getUser); // ✅ get single user
router.get("/:id/payment-methods", getUserPaymentMethodsDetailed); // ✅ get user payment methods detailed for admin
router.get("/:id/payment-methods-status", getUserPaymentMethods); // ✅ get user payment methods status
router.get("/:id/billing-history", getUserBillingHistory); // ✅ get user billing history for admin
router.delete("/:id/payment-methods/:paymentMethodId", deleteUserPaymentMethod); // ✅ delete user payment method by admin
router.put("/:id", upload.single("profileImage"), editProfile); // ✅ edit user profile

module.exports = router;
