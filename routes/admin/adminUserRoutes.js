const express = require("express");
const router = express.Router();
const multer = require("multer");

const storage = multer.memoryStorage();
const upload = multer({ storage });
const {
  getAllUsers,
  getUser,
  editProfile
} = require("../../controllers/admin/adminUserController");

router.get("/", getAllUsers);
router.get("/:id", getUser); // ✅ get single user
router.put("/:id", upload.single("profileImage"), editProfile); // ✅ edit user profile

module.exports = router;
