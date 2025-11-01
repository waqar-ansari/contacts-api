const Configuration = require("../../models/configurationModel");

// GET all configurations
const getAllConfigurations = async (req, res) => {
  try {
    console.log("Fetching all configurations");

    const configurations = await Configuration.find().sort({
      category: 1,
      key: 1,
    });

    res.status(200).json({
      status: "success",
      message: "Configurations retrieved successfully",
      data: configurations,
    });
  } catch (err) {
    console.error("Get Configurations Error:", err);
    res.status(500).json({ status: "error", message: "Server error" });
  }
};

// GET single configuration by key
const getConfiguration = async (req, res) => {
  try {
    const { key } = req.params;
    console.log("Fetching configuration:", key);

    const configuration = await Configuration.findOne({ key });

    if (!configuration) {
      return res.status(404).json({
        status: "error",
        message: "Configuration not found",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Configuration retrieved successfully",
      data: configuration,
    });
  } catch (err) {
    console.error("Get Configuration Error:", err);
    res.status(500).json({ status: "error", message: "Server error" });
  }
};

// POST/PUT - Create or update configuration
const setConfiguration = async (req, res) => {
  try {
    const { key, value, description, category } = req.body;

    if (!key || value === undefined || value === null) {
      return res.status(400).json({
        status: "error",
        message: "Key and value are required",
      });
    }

    console.log("Setting configuration:", key, "=", value);

    const configuration = await Configuration.setValue(
      key,
      value,
      description || "",
      category || "general"
    );

    res.status(200).json({
      status: "success",
      message: "Configuration updated successfully",
      data: configuration,
    });
  } catch (err) {
    console.error("Set Configuration Error:", err);
    res.status(500).json({ status: "error", message: "Server error" });
  }
};

// DELETE configuration
const deleteConfiguration = async (req, res) => {
  try {
    const { key } = req.params;
    console.log("Deleting configuration:", key);

    // Prevent deletion of critical configurations
    const protectedKeys = ["days_before_expiry"];
    if (protectedKeys.includes(key)) {
      return res.status(400).json({
        status: "error",
        message: "This configuration cannot be deleted",
      });
    }

    const configuration = await Configuration.findOneAndDelete({ key });

    if (!configuration) {
      return res.status(404).json({
        status: "error",
        message: "Configuration not found",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Configuration deleted successfully",
    });
  } catch (err) {
    console.error("Delete Configuration Error:", err);
    res.status(500).json({ status: "error", message: "Server error" });
  }
};

// GET subscription expiry settings specifically
const getSubscriptionExpirySettings = async (req, res) => {
  try {
    console.log("Fetching subscription expiry settings");

    const daysBeforeExpiry = await Configuration.getValue(
      "days_before_expiry",
      [7]
    );

    res.status(200).json({
      status: "success",
      message: "Subscription expiry settings retrieved successfully",
      data: {
        days_before_expiry: Array.isArray(daysBeforeExpiry)
          ? daysBeforeExpiry
          : [daysBeforeExpiry],
      },
    });
  } catch (err) {
    console.error("Get Subscription Expiry Settings Error:", err);
    res.status(500).json({ status: "error", message: "Server error" });
  }
};

// PUT subscription expiry settings specifically
const updateSubscriptionExpirySettings = async (req, res) => {
  try {
    const { days_before_expiry } = req.body;

    if (!days_before_expiry || !Array.isArray(days_before_expiry)) {
      return res.status(400).json({
        status: "error",
        message: "days_before_expiry must be an array",
      });
    }

    if (days_before_expiry.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "At least one day value is required",
      });
    }

    // Validate each value
    const validatedDays = [];
    for (const day of days_before_expiry) {
      const daysValue = parseInt(day);
      if (isNaN(daysValue) || daysValue < 1 || daysValue > 90) {
        return res.status(400).json({
          status: "error",
          message: "Each day value must be a number between 1 and 90",
        });
      }
      validatedDays.push(daysValue);
    }

    // Check for duplicates
    const uniqueDays = [...new Set(validatedDays)];
    if (uniqueDays.length !== validatedDays.length) {
      return res.status(400).json({
        status: "error",
        message: "Duplicate day values are not allowed",
      });
    }

    console.log("Updating subscription expiry settings:", uniqueDays);

    const configuration = await Configuration.setValue(
      "days_before_expiry",
      uniqueDays.sort((a, b) => a - b), // Sort ascending
      "Number of days before subscription expiry to send alert emails",
      "subscription"
    );

    res.status(200).json({
      status: "success",
      message: "Subscription expiry settings updated successfully",
      data: {
        days_before_expiry: configuration.value,
      },
    });
  } catch (err) {
    console.error("Update Subscription Expiry Settings Error:", err);
    res.status(500).json({ status: "error", message: "Server error" });
  }
};

// GET subscription email template
const getSubscriptionEmailTemplate = async (req, res) => {
  try {
    console.log("Fetching subscription email template");

    const emailSubject = await Configuration.getValue(
      "expiry_email_subject",
      "Your Subscription is Expiring Soon"
    );

    const emailBody = await Configuration.getValue(
      "expiry_email_body",
      `<p>Hi {{userName}},</p>
<p>Your <strong>{{planName}}</strong> subscription is ending soon—just <strong>{{daysLeft}}</strong> day(s) left!</p>
<div class="highlight">
  <strong>Your subscription will expire on {{expiryDate}}</strong>
</div>
<p>Contacts Management helps you organize, manage, and grow your professional network effortlessly. Don't lose access to your premium features!</p>
<div class="benefits">
  <p><strong>Why Continue with Contacts Management?</strong></p>
  <ul>
    <li>Unlimited contacts and advanced contact management</li>
    <li>Seamless integrations with Gmail, Outlook, iCloud & more</li>
    <li>Digital business cards and QR code sharing</li>
    <li>Advanced analytics and insights on your network</li>
  </ul>
</div>
<p><strong>Ready to continue hassle-free?</strong></p>`
    );

    res.status(200).json({
      status: "success",
      message: "Email template retrieved successfully",
      data: {
        subject: emailSubject,
        body: emailBody,
      },
    });
  } catch (err) {
    console.error("Get Email Template Error:", err);
    res.status(500).json({ status: "error", message: "Server error" });
  }
};

// PUT subscription email template
const updateSubscriptionEmailTemplate = async (req, res) => {
  try {
    const { subject, body } = req.body;

    if (!subject || !subject.trim()) {
      return res.status(400).json({
        status: "error",
        message: "Email subject is required",
      });
    }

    if (!body || !body.trim()) {
      return res.status(400).json({
        status: "error",
        message: "Email body is required",
      });
    }

    console.log("Updating subscription email template");

    await Configuration.setValue(
      "expiry_email_subject",
      subject.trim(),
      "Email subject for subscription expiry alerts",
      "subscription"
    );

    await Configuration.setValue(
      "expiry_email_body",
      body.trim(),
      "Email body content for subscription expiry alerts. This content will be wrapped in a styled HTML template with logo, upgrade button, and footer. Supports placeholders: {{userName}}, {{planName}}, {{expiryDate}}, {{daysLeft}}",
      "subscription"
    );

    res.status(200).json({
      status: "success",
      message: "Email template updated successfully",
      data: {
        subject: subject.trim(),
        body: body.trim(),
      },
    });
  } catch (err) {
    console.error("Update Email Template Error:", err);
    res.status(500).json({ status: "error", message: "Server error" });
  }
};

module.exports = {
  getAllConfigurations,
  getConfiguration,
  setConfiguration,
  deleteConfiguration,
  getSubscriptionExpirySettings,
  updateSubscriptionExpirySettings,
  getSubscriptionEmailTemplate,
  updateSubscriptionEmailTemplate,
};
