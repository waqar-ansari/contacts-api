const express = require("express");
const router = express.Router();
const {
  getAllUsers,
  getUser,
} = require("../../controllers/admin/adminUserController");

router.get("/", getAllUsers);
router.get("/:id", getUser); // ✅ get single user

module.exports = router;
