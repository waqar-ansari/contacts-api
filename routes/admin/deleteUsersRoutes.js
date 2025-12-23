const express = require("express");
const router = express.Router();

const {
  deleteMultipleUsers,
} = require("../../controllers/admin/deleteUsersController");

router.delete(
  "/",
  deleteMultipleUsers
);

module.exports = router;
