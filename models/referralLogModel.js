const mongoose = require("mongoose");

const referralLogSchema = new mongoose.Schema({
    email: { type: String, required: false, unique: true },
    // phonenumber: { type: String, required: false, unique: true },
    phonenumbers: [
        {
            countryCode: {
                type: String,
            },
            number: {
                type: String,
            },
            _id: false,
        },
    ],
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    referredUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // optional, can be null if deleted
    signupDate: { type: Date, default: Date.now },
});

module.exports = mongoose.model("ReferralLog", referralLogSchema);