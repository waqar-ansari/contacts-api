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
} = require("../../controllers/admin/adminUserController");

const { AdminCheckPlanStatus } = require("../../middlewares/planValidation");

router.get("/", getAllUsers);
router.get("/count", getUsersCount); // ✅ get total users count excluding superadmin
router.get("/plans", getAllPlans); // ✅ get all plans for dropdown
router.get("/:id", AdminCheckPlanStatus(), getUser); // ✅ get single user
router.put("/:id", upload.single("profileImage"), editProfile); // ✅ edit user profile

module.exports = router;
