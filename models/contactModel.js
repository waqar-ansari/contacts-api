const { Schema, model, mongoose } = require("mongoose");

const taskSchema = new Schema(
  {
    taskId: {
      type: mongoose.Types.ObjectId, // FIXED
      default: () => new mongoose.Types.ObjectId(), // FIXED
    },
    taskTitle: String,
    taskDescription: String,
    taskDueDate: Date,
    taskDueTime: String,
    taskIsCompleted: { type: Boolean, default: false },
  },
  { _id: false }
);

const contactSchema = new Schema(
  {
    contact_id: {
      type: Schema.Types.ObjectId,
      // type: mongoose.Schema.Types.ObjectId,
      unique: true,
    },
    firstname: {
      type: String,
      // default: "Dummy Firstname",
    },
    lastname: {
      type: String,
      // default: "Dummy Lastname",
    },
    emailaddresses: {
      type: [String],
    },
    notes: {
      type: String,
    },
    website: {
      type: String,
    },
    // phonenumbers: [
    //   {
    //     _id: false,
    //     countryCode: {
    //       type: String,
    //     },
    //     number: {
    //       type: String,
    //     },
    //   },
    // ],
    phonenumbers: {
      type: [String],
    },
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

    tasks: [taskSchema],


    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

const Contact = model("Contact", contactSchema);
module.exports = Contact;
