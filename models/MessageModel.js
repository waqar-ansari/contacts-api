const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    messages: [
      {
        _id: false,
        message_id: {
          type: mongoose.Schema.Types.ObjectId,
          default: () => new mongoose.Types.ObjectId(),
        },
        text: {
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

module.exports = mongoose.model("AdminMessage", messageSchema);
