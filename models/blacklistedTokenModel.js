// models/blacklistedTokenModel.js
const mongoose = require("mongoose");

const blacklistedTokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }, // auto-delete when expired
});

module.exports = mongoose.model("BlacklistedToken", blacklistedTokenSchema);
