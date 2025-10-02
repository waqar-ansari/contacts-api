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
      enum: [
        "General",
        "Billing & Subscription",
        "Support",
        "Bug Report",
        "Others",
      ],
    },
    message: { type: String, trim: true },
    fileUrl: { type: String }, // S3 file URL
    subscribe: { type: Boolean, default: false },

    // Chat messages
    messages: [
      {
        sender: {
          type: String,
          enum: ["customer", "admin"],
          required: true,
        },
        content: {
          type: String,
          required: true,
          trim: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        senderInfo: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        // _id: true,
      },
    ],

    // Legacy fields - keeping for backward compatibility
    adminReply: { type: String, trim: true },
    lastRepliedAt: { type: Date },
    repliedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Admin who replied
    },

    // New fields for chat
    status: {
      type: String,
      enum: ["open", "closed"],
      default: "open",
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Pre-save hook to add initial customer message to messages array
helpSupportSchema.pre("save", function (next) {
  // Only add initial message on first save and if messages array is empty
  if (this.isNew && this.messages.length === 0 && this.message) {
    this.messages.push({
      sender: "customer",
      content: this.message,
      timestamp: this.createdAt || new Date(),
      senderInfo: this.userId,
    });
  }
  next();
});

module.exports = mongoose.model("HelpSupport", helpSupportSchema);
