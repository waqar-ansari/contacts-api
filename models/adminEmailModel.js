const mongoose = require("mongoose");

const adminEmailSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true },
    body: { type: String, required: true },
    filters: {
      helps: { type: [String], default: [] },
      goals: { type: String, default: "" },
      categories: { type: String, default: "" },
      employeeCount: { type: String, default: "" },
      gender: { type: String, default: "" },
      country: { type: String, default: "" },
    },
    sentCount: { type: Number, default: 0 },
    errorList: { type: Array, default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // admin id
  },
  { timestamps: true }
);

module.exports = mongoose.model("AdminEmail", adminEmailSchema);
