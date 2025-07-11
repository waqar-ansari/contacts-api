const { Schema, model, mongoose } = require("mongoose");

const taskSchema = new Schema(
  {
    task_id: {
      type: mongoose.Types.ObjectId, // FIXED
      default: () => new mongoose.Types.ObjectId(), // FIXED
    },
    taskTitle: String,
    taskDescription: String,
    taskDueDate: Date,
    taskDueTime: String,
    taskIsCompleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    _id: false,
  }
);

const meetingSchema = new Schema(
  {
    meeting_id: {
      type: mongoose.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
    },
    meetingTitle: String,
    meetingDescription: String,
    meetingStartDate: Date,
    meetingStartTime: String,
    meetingType: {
      type: String,
      enum: ["online", "offline"],
      default: "offline",
    },
    meetingLink: String,
    meetingLocation: String,
  },
  { timestamps: true, _id: false }
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
    company: {
      type: String,
      // default: "Dummy Lastname",
    },
    designation: {
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
      default: "",
    },
    isFavourite: {
      type: Boolean,
      default: false,
    },
    tags: [
      {
        _id: false,
        tag_id: {
          type: mongoose.Schema.Types.ObjectId,
          default: () => new mongoose.Types.ObjectId(),
        },
        tag: {
          type: String,
        },
        emoji: {
          type: String, // URL to S3
        },
      },
    ],

    linkedin: {
      type: String,
      // default: "Dummy Firstname",
    },
    instagram: {
      type: String,
      // default: "Dummy Firstname",
    },
    telegram: {
      type: String,
      // default: "Dummy Firstname",
    },
    twitter: {
      type: String,
      // default: "Dummy Firstname",
    },
    facebook: {
      type: String,
      // default: "Dummy Firstname",
    },

    tasks: [taskSchema],

    meetings: [meetingSchema],

    activities: [
      {
        _id: false,
        action: { type: String, required: true },
        type: {
          type: String,
          required: true,
          enum: ["contact", "task", "meeting", "tag", "email", "whatsapp"], // Optional but safer
        },
        description: { type: String },
        timestamp: { type: Date, default: Date.now },
      }
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
