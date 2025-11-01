const mongoose = require("mongoose");

const configurationSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    description: {
      type: String,
      default: "",
    },
    category: {
      type: String,
      default: "general",
    },
  },
  {
    timestamps: true,
  }
);

// Static method to get a config value
configurationSchema.statics.getValue = async function (
  key,
  defaultValue = null
) {
  const config = await this.findOne({ key });
  return config ? config.value : defaultValue;
};

// Static method to set a config value
configurationSchema.statics.setValue = async function (
  key,
  value,
  description = "",
  category = "general"
) {
  return this.findOneAndUpdate(
    { key },
    { value, description, category },
    { upsert: true, new: true }
  );
};

module.exports = mongoose.model("Configuration", configurationSchema);
