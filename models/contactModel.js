const { Schema, model } = require("mongoose");

const contactSchema = new Schema(
  {
    firstname: {
      type: String,
      default: "Dummy Firstname",
    },
    lastname: {
      type: String,
      default: "Dummy Lastname",
    },
    email: {
      type: String,
      //   required: true,
      //   unique: true,
    },
    mobilenumber: [
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
    createdBy:{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }
  },
  { timestamps: true }
);

const Contact = model("Contact", contactSchema);
module.exports = Contact;
