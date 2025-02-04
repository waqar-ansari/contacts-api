const { Schema, model, mongoose } = require("mongoose");

const contactSchema = new Schema(
  {
    contact_id: {
      type: mongoose.Schema.Types.ObjectId,
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
      //   required: true,
      //   unique: true,
    },
    phonenumbers: [
      {
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
    tags: {
      type: [String],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

const Contact = model("Contact", contactSchema);
module.exports = Contact;
