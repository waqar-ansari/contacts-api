const mongoose = require("mongoose");

const helpSupportSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        name: { type: String, trim: true },
        subject: { type: String, trim: true },
        // email: { type: String, required: true, trim: true, lowercase: true },
        emailaddresses: {
            type: [String],
        },
        // countryCode: { type: String, trim: true },
        // phoneNumber: { type: String, trim: true },
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
        inquiryType: {
            type: String,
            enum: ["General", "Billing & Subscription", "Support", "Bug Report", "Others"]
        },
        message: { type: String, trim: true },
        fileUrl: { type: String }, // S3 file URL
        subscribe: { type: Boolean, default: false },
    },
    { timestamps: true }
);

module.exports = mongoose.model("HelpSupport", helpSupportSchema);
