// routes/superAdminRoutes.js
const express = require("express");
const router = express.Router();

const { createAdmin } = require("../../controllers/admin/addAdminController");
// const auth = require("../middlewares/authMiddleware");
// const checkSuperAdmin = require("../middlewares/checkSuperAdmin");

router.post("/",  createAdmin);

module.exports = router;
