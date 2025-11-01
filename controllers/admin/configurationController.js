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
      7
    );

    res.status(200).json({
      status: "success",
      message: "Subscription expiry settings retrieved successfully",
      data: {
        days_before_expiry: daysBeforeExpiry,
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

    if (days_before_expiry === undefined || days_before_expiry === null) {
      return res.status(400).json({
        status: "error",
        message: "days_before_expiry is required",
      });
    }

    // Validate the value
    const daysValue = parseInt(days_before_expiry);
    if (isNaN(daysValue) || daysValue < 1 || daysValue > 90) {
      return res.status(400).json({
        status: "error",
        message: "days_before_expiry must be a number between 1 and 90",
      });
    }

    console.log("Updating subscription expiry settings:", daysValue);

    const configuration = await Configuration.setValue(
      "days_before_expiry",
      daysValue,
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

module.exports = {
  getAllConfigurations,
  getConfiguration,
  setConfiguration,
  deleteConfiguration,
  getSubscriptionExpirySettings,
  updateSubscriptionExpirySettings,
};
