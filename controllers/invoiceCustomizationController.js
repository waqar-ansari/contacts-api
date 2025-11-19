const { stripe, stripeTest } = require("../config/stripe");

/**
 * Get current account's invoice settings from Stripe
 * @route GET /api/admin/invoice-customization/settings
 * @access Private (Admin only)
 */
const getInvoiceSettings = async (req, res) => {
  try {
    const useTestMode = req.user.stripe_test_mode || false;
    const stripeInstance = useTestMode ? stripeTest : stripe;

    // Retrieve account settings from Stripe
    const account = await stripeInstance.accounts.retrieve();

    // Get branding settings
    const brandingSettings = {
      icon: account.settings?.branding?.icon || null,
      logo: account.settings?.branding?.logo || null,
      primary_color: account.settings?.branding?.primary_color || null,
      secondary_color: account.settings?.branding?.secondary_color || null,
    };

    // Get invoice settings
    const invoiceSettings = {
      default_footer: account.settings?.invoices?.default_footer || "",
      custom_fields: [],
    };

    // Get business profile
    const businessProfile = {
      name: account.business_profile?.name || "",
      support_address: account.business_profile?.support_address || {},
      support_email: account.business_profile?.support_email || "",
      support_phone: account.business_profile?.support_phone || "",
      support_url: account.business_profile?.support_url || "",
      url: account.business_profile?.url || "",
    };

    res.json({
      success: true,
      data: {
        branding: brandingSettings,
        invoice: invoiceSettings,
        business: businessProfile,
        account_name: account.settings?.dashboard?.display_name || "",
      },
    });
  } catch (error) {
    console.error("Error fetching invoice settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch invoice settings",
      error: error.message,
    });
  }
};

/**
 * Update account's business profile (name, address, contact info)
 * @route PUT /api/admin/invoice-customization/business-profile
 * @access Private (Admin only)
 */
const updateBusinessProfile = async (req, res) => {
  try {
    const useTestMode = req.user.stripe_test_mode || false;
    const stripeInstance = useTestMode ? stripeTest : stripe;

    const {
      name,
      support_email,
      support_phone,
      support_url,
      url,
      support_address,
    } = req.body;

    const updateData = {
      business_profile: {},
    };

    if (name) updateData.business_profile.name = name;
    if (support_email)
      updateData.business_profile.support_email = support_email;
    if (support_phone)
      updateData.business_profile.support_phone = support_phone;
    if (support_url) updateData.business_profile.support_url = support_url;
    if (url) updateData.business_profile.url = url;
    if (support_address) {
      updateData.business_profile.support_address = {
        line1: support_address.line1,
        line2: support_address.line2 || null,
        city: support_address.city,
        state: support_address.state || null,
        postal_code: support_address.postal_code,
        country: support_address.country,
      };
    }

    const account = await stripeInstance.accounts.update(
      "acct_" + (await stripeInstance.accounts.retrieve()).id.split("_")[1],
      updateData
    );

    res.json({
      success: true,
      message: "Business profile updated successfully",
      data: account.business_profile,
    });
  } catch (error) {
    console.error("Error updating business profile:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update business profile",
      error: error.message,
    });
  }
};

/**
 * Update default invoice footer
 * @route PUT /api/admin/invoice-customization/footer
 * @access Private (Admin only)
 */
const updateDefaultFooter = async (req, res) => {
  try {
    const useTestMode = req.user.stripe_test_mode || false;
    const stripeInstance = useTestMode ? stripeTest : stripe;

    const { footer } = req.body;

    if (!footer && footer !== "") {
      return res.status(400).json({
        success: false,
        message: "Footer text is required",
      });
    }

    const account = await stripeInstance.accounts.update(
      "acct_" + (await stripeInstance.accounts.retrieve()).id.split("_")[1],
      {
        settings: {
          invoices: {
            default_footer: footer,
          },
        },
      }
    );

    res.json({
      success: true,
      message: "Default footer updated successfully",
      data: {
        footer: account.settings?.invoices?.default_footer || "",
      },
    });
  } catch (error) {
    console.error("Error updating default footer:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update default footer",
      error: error.message,
    });
  }
};

/**
 * Update branding settings (colors only - file uploads handled separately)
 * @route PUT /api/admin/invoice-customization/branding
 * @access Private (Admin only)
 */
const updateBranding = async (req, res) => {
  try {
    const useTestMode = req.user.stripe_test_mode || false;
    const stripeInstance = useTestMode ? stripeTest : stripe;

    const { primary_color, secondary_color } = req.body;

    const updateData = {
      settings: {
        branding: {},
      },
    };

    if (primary_color) {
      // Validate hex color format
      if (!/^#[0-9A-F]{6}$/i.test(primary_color)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid primary color format. Use hex format (e.g., #FF5733)",
        });
      }
      updateData.settings.branding.primary_color = primary_color;
    }

    if (secondary_color) {
      if (!/^#[0-9A-F]{6}$/i.test(secondary_color)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid secondary color format. Use hex format (e.g., #FF5733)",
        });
      }
      updateData.settings.branding.secondary_color = secondary_color;
    }

    const account = await stripeInstance.accounts.update(
      "acct_" + (await stripeInstance.accounts.retrieve()).id.split("_")[1],
      updateData
    );

    res.json({
      success: true,
      message: "Branding updated successfully",
      data: account.settings?.branding || {},
    });
  } catch (error) {
    console.error("Error updating branding:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update branding",
      error: error.message,
    });
  }
};

/**
 * Update account display name
 * @route PUT /api/admin/invoice-customization/account-name
 * @access Private (Admin only)
 */
const updateAccountName = async (req, res) => {
  try {
    const useTestMode = req.user.stripe_test_mode || false;
    const stripeInstance = useTestMode ? stripeTest : stripe;

    const { account_name } = req.body;

    if (!account_name) {
      return res.status(400).json({
        success: false,
        message: "Account name is required",
      });
    }

    const account = await stripeInstance.accounts.update(
      "acct_" + (await stripeInstance.accounts.retrieve()).id.split("_")[1],
      {
        settings: {
          dashboard: {
            display_name: account_name,
          },
        },
      }
    );

    res.json({
      success: true,
      message: "Account name updated successfully",
      data: {
        account_name: account.settings?.dashboard?.display_name || "",
      },
    });
  } catch (error) {
    console.error("Error updating account name:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update account name",
      error: error.message,
    });
  }
};

/**
 * Upload logo/icon to Stripe (file upload)
 * @route POST /api/admin/invoice-customization/upload-logo
 * @access Private (Admin only)
 */
const uploadLogo = async (req, res) => {
  try {
    const useTestMode = req.user.stripe_test_mode || false;
    const stripeInstance = useTestMode ? stripeTest : stripe;

    const { purpose, file_data, file_name } = req.body;

    if (!purpose || !file_data) {
      return res.status(400).json({
        success: false,
        message: "Purpose and file data are required",
      });
    }

    // Purpose should be 'icon' or 'logo'
    if (purpose !== "icon" && purpose !== "logo") {
      return res.status(400).json({
        success: false,
        message: "Purpose must be 'icon' or 'logo'",
      });
    }

    // Create file from base64 data
    const buffer = Buffer.from(file_data, "base64");

    const file = await stripeInstance.files.create({
      purpose: "business_" + purpose,
      file: {
        data: buffer,
        name: file_name || "logo.png",
        type: "application/octet-stream",
      },
    });

    // Update account with new logo/icon
    const updateData = {
      settings: {
        branding: {},
      },
    };

    updateData.settings.branding[purpose] = file.id;

    const account = await stripeInstance.accounts.update(
      "acct_" + (await stripeInstance.accounts.retrieve()).id.split("_")[1],
      updateData
    );

    res.json({
      success: true,
      message: `${
        purpose.charAt(0).toUpperCase() + purpose.slice(1)
      } uploaded successfully`,
      data: {
        file_id: file.id,
        branding: account.settings?.branding || {},
      },
    });
  } catch (error) {
    console.error("Error uploading logo:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload logo",
      error: error.message,
    });
  }
};

module.exports = {
  getInvoiceSettings,
  updateBusinessProfile,
  updateDefaultFooter,
  updateBranding,
  updateAccountName,
  uploadLogo,
};
