const mongoose = require("mongoose");

const referralSchema = new mongoose.Schema({
    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    friendName: String,
    email: String,
    phonenumbers: String,
    referralCode: {
        type: String,
        required: true
    },
    referredUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    usedOnce: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ["pending", "complete"],
        default: "pending"
    },
    signupDate: Date  // ✅ Add this line

}, { timestamps: true });

module.exports = mongoose.model("Referral", referralSchema);
