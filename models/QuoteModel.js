const mongoose = require("mongoose");

const quoteSchema = new mongoose.Schema(
  {
    quotes: [
      {
        _id: false,
        quote_id: {
          type: mongoose.Schema.Types.ObjectId,
          default: () => new mongoose.Types.ObjectId(),
        },
        quoteText: {
          type: String,
          required: true,
          trim: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true, // should always be the super admin
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AdminQuote", quoteSchema);
