const express = require("express");
const router = express.Router();
const {
  getInvoiceSettings,
  updateBusinessProfile,
  updateDefaultFooter,
  updateBranding,
  updateAccountName,
  uploadLogo,
} = require("../controllers/invoiceCustomizationController");

// GET current invoice settings from Stripe
router.get("/settings", getInvoiceSettings);

// PUT update business profile (name, address, contact info)
router.put("/business-profile", updateBusinessProfile);

// PUT update default invoice footer
router.put("/footer", updateDefaultFooter);

// PUT update branding colors
router.put("/branding", updateBranding);

// PUT update account display name
router.put("/account-name", updateAccountName);

// POST upload logo/icon
router.post("/upload-logo", uploadLogo);

module.exports = router;
