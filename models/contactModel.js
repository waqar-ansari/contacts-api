const { Schema, model, mongoose } = require("mongoose");

const contactSchema = new Schema(
  {
    contact_id: {
      type: Schema.Types.ObjectId,
      // type: mongoose.Schema.Types.ObjectId,
      unique: true,
    },
    firstname: {
      type: String,
      default: "Dummy Firstname",
    },
    lastname: {
      type: String,
      default: "Dummy Lastname",
    },
    emailaddresses: {
      type: [String],
    },
    phonenumbers: [
      {
        _id: false,
        countryCode: {
          type: String,
        },
        number: {
          type: String,
        },
      },
    ],
    contactImageURL: {
      type: String,
      default: "/images/defaultUserPic.png",
    },
    isFavourite: {
      type: Boolean,
      default: false,
    },
    tags: [
      {
        _id: false,
        tag_id: {
          type: Schema.Types.ObjectId,
        },
        tag: {
          type: String,
        },
      },
    ],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

const Contact = model("Contact", contactSchema);
module.exports = Contact;
