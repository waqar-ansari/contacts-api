// routes/admin/configurationRoutes.js
const express = require("express");
const router = express.Router();
const {
  getAllConfigurations,
  getConfiguration,
  setConfiguration,
  deleteConfiguration,
  getSubscriptionExpirySettings,
  updateSubscriptionExpirySettings,
  getSubscriptionEmailTemplate,
  updateSubscriptionEmailTemplate,
} = require("../../controllers/admin/configurationController");

// GET all configurations
router.get("/", getAllConfigurations);

// GET/PUT subscription expiry settings (dedicated endpoint)
router.get("/subscription-expiry", getSubscriptionExpirySettings);
router.put("/subscription-expiry", updateSubscriptionExpirySettings);

// GET/PUT subscription email template (dedicated endpoint)
router.get("/subscription-email", getSubscriptionEmailTemplate);
router.put("/subscription-email", updateSubscriptionEmailTemplate);

// GET single configuration by key
router.get("/:key", getConfiguration);

// POST/PUT configuration
router.post("/", setConfiguration);
router.put("/", setConfiguration);

// DELETE configuration
router.delete("/:key", deleteConfiguration);

module.exports = router;
