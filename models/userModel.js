const { createHmac, randomBytes } = require("crypto");
const { Schema, model, mongoose } = require("mongoose");
const { createTokenforUser } = require("../services/authentication");

const whatsappTemplateSchema = new Schema(
  {
    whatsappTemplate_id: {
      type: mongoose.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
    },
    whatsappTemplateTitle: String,
    whatsappTemplateMessage: String,
    whatsappTemplateIsFavourite: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    _id: false,
  }
);


const emailTemplateSchema = new Schema(
  {
    emailTemplate_id: {
      type: mongoose.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
    },
    emailTemplateTitle: String,
    emailTemplateSubject: String,
    emailTemplateBody: String,
    emailTemplateIsFavourite: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    _id: false,
  }
);


const reminderSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: "",
    },
    date: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true, _id: true }
);

const userSchema = new Schema(
  {

    reminders: [reminderSchema],

    // whatsappTemplates: [whatsappTemplateSchema],

    // emailTemplates: [emailTemplateSchema],

    whatsappTemplates: {
      type: [whatsappTemplateSchema],
      default: () => [
        {
          whatsappTemplate_id: new mongoose.Types.ObjectId(),
          whatsappTemplateTitle: "Welcome Message",
          whatsappTemplateMessage: "Hey {{firstname}}! 👋 Welcome to our platform. Let me know if you need any help getting started.",
          whatsappTemplateIsFavourite: true
        },
        {
          whatsappTemplate_id: new mongoose.Types.ObjectId(),
          whatsappTemplateTitle: "Follow-up",
          whatsappTemplateMessage: "Hi {{firstname}}, just checking in to see if you had a chance to review our last conversation.",
          whatsappTemplateIsFavourite: false
        },
        {
          whatsappTemplate_id: new mongoose.Types.ObjectId(),
          whatsappTemplateTitle: "Meeting Reminder",
          whatsappTemplateMessage: "Reminder: Your meeting with us is scheduled for {{meetingDate}}. Let us know if you need to reschedule.",
          whatsappTemplateIsFavourite: false
        },
        {
          whatsappTemplate_id: new mongoose.Types.ObjectId(),
          whatsappTemplateTitle: "Thank You",
          whatsappTemplateMessage: "Thanks a lot for your time today, {{firstname}}! 😊 Looking forward to staying in touch.",
          whatsappTemplateIsFavourite: true
        },
        {
          whatsappTemplate_id: new mongoose.Types.ObjectId(),
          whatsappTemplateTitle: "Support Offer",
          whatsappTemplateMessage: "Hi {{firstname}}, if you have any questions or need assistance, feel free to reply to this message. We're here to help! 🙌",
          whatsappTemplateIsFavourite: false
        }
      ]
    },

    emailTemplates: {
      type: [emailTemplateSchema],
      default: () => [
        {
          emailTemplate_id: new mongoose.Types.ObjectId(),
          emailTemplateTitle: "Welcome Email",
          emailTemplateSubject: "Welcome to Our Platform!",
          emailTemplateBody: "Hi {{firstname}},\n\nThank you for joining us! We're excited to have you on board.\n\nBest,\nTeam",
          emailTemplateIsFavourite: true
        },
        {
          emailTemplate_id: new mongoose.Types.ObjectId(),
          emailTemplateTitle: "Follow-up Email",
          emailTemplateSubject: "Just checking in",
          emailTemplateBody: "Hi {{firstname}},\n\nI wanted to follow up on our last conversation. Let me know if you have any questions.\n\nRegards,\n{{senderName}}",
          emailTemplateIsFavourite: false
        },
        {
          emailTemplate_id: new mongoose.Types.ObjectId(),
          emailTemplateTitle: "Meeting Reminder",
          emailTemplateSubject: "Upcoming Meeting Reminder",
          emailTemplateBody: "Hi {{firstname}},\n\nThis is a quick reminder for our meeting scheduled on {{meetingDate}}.\n\nThanks,\n{{senderName}}",
          emailTemplateIsFavourite: false
        },
        {
          emailTemplate_id: new mongoose.Types.ObjectId(),
          emailTemplateTitle: "Thank You Email",
          emailTemplateSubject: "Thank You!",
          emailTemplateBody: "Hi {{firstname}},\n\nJust wanted to thank you for your time today. Looking forward to our next steps.\n\nCheers,\n{{senderName}}",
          emailTemplateIsFavourite: true
        },
        {
          emailTemplate_id: new mongoose.Types.ObjectId(),
          emailTemplateTitle: "Feedback Request",
          emailTemplateSubject: "We'd love your feedback!",
          emailTemplateBody: "Hi {{firstname}},\n\nWe hope you're enjoying our service. We'd appreciate it if you could share your thoughts or suggestions.\n\nWarm regards,\nTeam",
          emailTemplateIsFavourite: false
        }
      ]
    },

    serialNumber: {
      type: String,
      unique: true,
      index: true,
    },

    firstname: {
      type: String,
      // default: "Dummy Firstname",
    },
    lastname: {
      type: String,
      // default: "Dummy Lastname",
    },

    gender: {
      type: String,
      // default: "Dummy Lastname",
    },

    email: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      // default: null, // ✅ makes sure null is used instead of ""
    },

    googleId: String,
    googleEmail: String,
    googleAccessToken: String,
    googleRefreshToken: String,
    googleConnected: {
      type: Boolean,
      default: false,
    },

    microsoftId: String,
    microsoftEmail: String,
    microsoftAccessToken: String,
    microsoftConnected: { type: Boolean, default: false },

    smtpHost: { type: String },
    smtpPort: { type: Number },
    smtpUser: { type: String },
    smtpPass: { type: String },
    smtpSecure: { type: Boolean, default: true },
    smtpConnected: { type: Boolean, default: false },

    emailVerificationToken: String,
    isVerified: {
      type: Boolean,
      default: false
    },    // tags: [
    //   {
    //     _id: false,
    //     tag_id: {
    //       type: mongoose.Schema.Types.ObjectId,
    //       unique: true,
    //     },
    //     tag: {
    //       type: String,
    //     },
    //   },
    // ],

    signupMethod: {
      type: String,
      enum: ["email", "phoneNumber", "google", "apple"],
      default: "email"  // or leave unset until signup
    },

    tags: {
      type: [
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
            type: String, // emoji
          },
        }
      ],
      default: () => [
        {
          tag_id: new mongoose.Types.ObjectId(),
          tag: "Family",
          emoji: "🖤"
        },
        {
          tag_id: new mongoose.Types.ObjectId(),
          tag: "Networking",
          emoji: "🤝"
        },
        {
          tag_id: new mongoose.Types.ObjectId(),
          tag: "Coworkers",
          emoji: "💼"
        },
        {
          tag_id: new mongoose.Types.ObjectId(),
          tag: "Friends",
          emoji: "⚽"
        }
      ]
    },

    userInfo: {
      helps: {
        type: [String],
        default: []
      },
      goals: {
        type: String,
        default: ""
      },
      categories: {
        type: String,
        default: ""
      },
      employeeCount: {
        type: String,
        default: ""
      },
      companyName: {
        type: String,
        default: ""
      },
    },


    // phonenumbers: [
    //   {
    //     countryCode: {
    //       type: String,
    //     },
    //     number: {
    //       type: String,
    //     },
    //   },
    // ],
    // phonenumber: {
    //   countryCode: {
    //     type: String,
    //     default: "",
    //   },
    //   number: {
    //     type: String,
    //     default: "",
    //   },
    // },
    phonenumbers: {
      type: [String],
    },

    otp: { type: String },
    otpExpiresAt: { type: Date },

    salt: {
      type: String,
      // required: true,
    },
    password: {
      type: String,
      required: function () {
        // Only require password for local users
        return !this.provider || this.provider === "local";
      },
    },
    provider: {
      type: String,
      enum: ["local", "google", "apple"],
      default: "local",
    },

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
    designation: {
      type: String,
      // default: "Dummy Firstname",
    },

    qrCode: { type: String },


    profileImageURL: {
      type: String,
    },

    shareProfileCount: {
      type: Number,
      default: 0
    },

    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    // iScanned: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    // scannedMe: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    iScanned: [mongoose.Schema.Types.Mixed],  // can be object or userId
    scannedMe: [mongoose.Schema.Types.Mixed]
  },
  { timestamps: true }
);

userSchema.pre("save", function (next) {
  const user = this;
  if (!user.isModified("password")) return next();

  const salt = randomBytes(16).toString();
  const hashPassword = createHmac("sha256", salt)
    .update(user.password)
    .digest("hex");

  this.salt = salt;
  this.password = hashPassword;
  next();
});

userSchema.static("matchPasswordAndGenerateToken", async function ({ email, phonenumber, password }) {
  if (!password || (!email && !phonenumber)) {
    throw new Error("Email or phone number and password are required");
  }

  const query = email
    ? { email }
    : { phonenumbers: { $in: [phonenumber] } }; // assuming you store phone numbers as array

  const user = await this.findOne(query);
  if (!user) throw new Error("User not found");

  const hash = createHmac("sha256", user.salt).update(password).digest("hex");
  if (hash !== user.password) throw new Error("Password not matched");

  return createTokenforUser(user);
});

const User = model("User", userSchema);
module.exports = User;
