// models/Plan.js
const mongoose = require("mongoose");

const planSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true }, // Starter, Pro, Business, Enterprise
    price: { type: String, required: true }, // "$9.99/month" or "Free" or "Custom"
    description: { type: String },
    features: [String], // array of features
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model("Plan", planSchema);
