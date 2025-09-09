const { createHmac, randomBytes } = require("crypto");
const { Schema, model, mongoose } = require("mongoose");
const { createTokenforUser } = require("../services/authentication");
const Contact = require("./contactModel"); // Adjust path if needed
// const { getNextSerialNumber } = require("../utils/serialUtils");
const Counter = require("./counterModel");

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
          whatsappTemplateMessage:
            "Hey {{firstName}}! 👋 Welcome to our platform. Let me know if you need any help getting started.",
          whatsappTemplateIsFavourite: true,
        },
        {
          whatsappTemplate_id: new mongoose.Types.ObjectId(),
          whatsappTemplateTitle: "Follow-up",
          whatsappTemplateMessage:
            "Hi {{firstName}}, just checking in to see if you had a chance to review our last conversation.",
          whatsappTemplateIsFavourite: false,
        },
        {
          whatsappTemplate_id: new mongoose.Types.ObjectId(),
          whatsappTemplateTitle: "Meeting Reminder",
          whatsappTemplateMessage:
            "Reminder: Your meeting with us is scheduled for {{meetingDate}}. Let us know if you need to reschedule.",
          whatsappTemplateIsFavourite: false,
        },
        {
          whatsappTemplate_id: new mongoose.Types.ObjectId(),
          whatsappTemplateTitle: "Thank You",
          whatsappTemplateMessage:
            "Thanks a lot for your time today, {{firstName}}! 😊 Looking forward to staying in touch.",
          whatsappTemplateIsFavourite: true,
        },
        {
          whatsappTemplate_id: new mongoose.Types.ObjectId(),
          whatsappTemplateTitle: "Support Offer",
          whatsappTemplateMessage:
            "Hi {{firstName}}, if you have any questions or need assistance, feel free to reply to this message. We're here to help! 🙌",
          whatsappTemplateIsFavourite: false,
        },
      ],
    },

    emailTemplates: {
      type: [emailTemplateSchema],
      default: () => [
        {
          emailTemplate_id: new mongoose.Types.ObjectId(),
          emailTemplateTitle: "Welcome Email",
          emailTemplateSubject: "Welcome to Our Platform!",
          emailTemplateBody:
            "Hi {{firstName}},\n\nThank you for joining us! We're excited to have you on board.\n\nBest,\nTeam",
          emailTemplateIsFavourite: true,
        },
        {
          emailTemplate_id: new mongoose.Types.ObjectId(),
          emailTemplateTitle: "Follow-up Email",
          emailTemplateSubject: "Just checking in",
          emailTemplateBody:
            "Hi {{firstName}},\n\nI wanted to follow up on our last conversation. Let me know if you have any questions.\n\nRegards,\n{{senderName}}",
          emailTemplateIsFavourite: false,
        },
        {
          emailTemplate_id: new mongoose.Types.ObjectId(),
          emailTemplateTitle: "Meeting Reminder",
          emailTemplateSubject: "Upcoming Meeting Reminder",
          emailTemplateBody:
            "Hi {{firstName}},\n\nThis is a quick reminder for our meeting scheduled on {{meetingDate}}.\n\nThanks,\n{{senderName}}",
          emailTemplateIsFavourite: false,
        },
        {
          emailTemplate_id: new mongoose.Types.ObjectId(),
          emailTemplateTitle: "Thank You Email",
          emailTemplateSubject: "Thank You!",
          emailTemplateBody:
            "Hi {{firstName}},\n\nJust wanted to thank you for your time today. Looking forward to our next steps.\n\nCheers,\n{{senderName}}",
          emailTemplateIsFavourite: true,
        },
        {
          emailTemplate_id: new mongoose.Types.ObjectId(),
          emailTemplateTitle: "Feedback Request",
          emailTemplateSubject: "We'd love your feedback!",
          emailTemplateBody:
            "Hi {{firstName}},\n\nWe hope you're enjoying our service. We'd appreciate it if you could share your thoughts or suggestions.\n\nWarm regards,\nTeam",
          emailTemplateIsFavourite: false,
        },
      ],
    },
    serialNumber: {
      type: String,
      unique: true,
      required: true,
      default: "", // Avoids null
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

    googleId: { type: String }, // ✅ Store Google user ID as String
    googleEmail: String,
    googleAccessToken: String,
    googleRefreshToken: String,
    googleConnected: {
      type: Boolean,
      default: false,
    },

    microsoftId: { type: String }, // ✅ Store Microsoft ID as String (not ObjectId)
    microsoftEmail: String,
    microsoftAccessToken: String,
    microsoftConnected: { type: Boolean, default: false },

    smtpId: {
      type: mongoose.Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
    }, // SMTP ID can stay ObjectId
    smtpHost: { type: String },
    smtpPort: { type: Number },
    smtpUser: { type: String },
    smtpPass: { type: String },
    smtpSecure: { type: Boolean, default: true },
    smtpConnected: { type: Boolean, default: false },

    emailVerificationToken: String,
    isVerified: {
      type: Boolean,
      default: false,
    }, // tags: [
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
      enum: ["email", "phoneNumber", "google", "apple", "linkedin"],
      default: "email", // or leave unset until signup
    },

    role: {
      type: String,
      enum: ["user", "superadmin"],
      default: "user",
    },

    trialStart: { type: Date },
    trialEnd: { type: Date },
    isPremium: { type: Boolean, default: false },
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      default: null,
    },
    planActivatedAt: { type: Date, default: null },
    planExpiresAt: { type: Date, default: null },
    isActive: {
      type: Boolean,
      default: false, // user is inactive until login
    },

    lastSeen: { type: Date, default: null },

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
        },
      ],
      default: () => [
        {
          tag_id: new mongoose.Types.ObjectId(),
          tag: "Family",
          emoji: "🖤",
        },
        {
          tag_id: new mongoose.Types.ObjectId(),
          tag: "Networking",
          emoji: "🤝",
        },
        {
          tag_id: new mongoose.Types.ObjectId(),
          tag: "Coworkers",
          emoji: "💼",
        },
        {
          tag_id: new mongoose.Types.ObjectId(),
          tag: "Friends",
          emoji: "⚽",
        },
      ],
    },

    userInfo: {
      helps: {
        type: [String],
        default: [],
      },
      goals: {
        type: String,
        default: "",
      },
      categories: {
        type: String,
        default: "",
      },
      employeeCount: {
        type: String,
        default: "",
      },
      companyName: {
        type: String,
        default: "",
      },
    },

    phonenumbers: [
      {
        countryCode: {
          type: String,
        },
        number: {
          type: String,
        },
        _id: false, // Use the number as the unique identifier
      },
    ],
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
    // phonenumbers: {
    //   type: [String],
    // },

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
      enum: ["local", "google", "apple", "linkedin"],
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
      default: 0,
    },

    referralCode: {
      type: String,
      unique: true,
      sparse: true,
    },

    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // referredByAdmin: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "Admin",
    // },

    tenantId: {
      type: String,
      unique: true,
      sparse: true, // only enforce uniqueness when tenantId is present
    },

    creditBalance: {
      type: Number,
      default: 0, // every user starts with $0 credit
    },

    // Flag to track if user has used free trial of Pro plan
    hasUsedProTrial: {
      type: Boolean,
      default: false,
    },

    // myReferrals: {
    //   type: [
    //     {
    //       _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    //       firstname: String,
    //       lastname: String,
    //       email: String,
    //       phonenumbers: [
    //         {
    //           countryCode: { type: String, default: "" },
    //           number: { type: String, default: "" },
    //           _id: false
    //         }
    //       ],
    //       signupDate: Date,
    //     }
    //   ],
    //   default: [],
    // },

    // replace existing myReferrals block with this:
    myReferrals: {
      type: [
        new mongoose.Schema(
          {
            _id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            firstname: { type: String, default: "" },
            lastname: { type: String, default: "" },
            email: { type: String, default: "" },
            phonenumbers: [
              {
                countryCode: { type: String, default: "" },
                number: { type: String, default: "" },
                _id: false,
              },
            ],
            signupDate: { type: Date, default: null },
          },
          { _id: false }
        ), // avoid auto subdoc _id (we keep the _id field for referred user)
      ],
      default: [],
    },

    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    // iScanned: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    // scannedMe: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    iScanned: [mongoose.Schema.Types.Mixed], // can be object or userId
    scannedMe: [mongoose.Schema.Types.Mixed],
  },
  { timestamps: true }
);

userSchema.pre("save", function (next) {
  const user = this;
  // 🛑 Assign serial number if not already set
  // if (!user.serialNumber) {
  //   user.serialNumber = await this.constructor.getNextSerialNumber();
  // }
  if (!user.isModified("password")) return next();

  const salt = randomBytes(16).toString();
  const hashPassword = createHmac("sha256", salt)
    .update(user.password)
    .digest("hex");

  this.salt = salt;
  this.password = hashPassword;
  next();
});

userSchema.post("save", async function (doc, next) {
  try {
    const existingDefault = await Contact.findOne({
      createdBy: doc._id,
      firstname: { $regex: /^california$/i },
      lastname: { $regex: /^media$/i },
    });

    const _id = new mongoose.Types.ObjectId();

    if (!existingDefault) {
      await Contact.create({
        _id,
        contact_id: _id,
        firstname: "California",
        lastname: "Media",
        emailaddresses: ["web@californiamediauae.com"],
        // phonenumbers: ["971 50 875 8109"],
        linkedin: "https://linkedin.com/company/californiamedia",
        instagram: "https://instagram.com/californiamedia",
        telegram: "https://t.me/californiamedia",
        twitter: "https://twitter.com/californiamedia",
        facebook: "https://facebook.com/californiamedia",
        // contactImageURL: "https://example.com/default-contact.jpg",
        isFavourite: true,
        // tags: [
        //   {
        //     tag_id: new mongoose.Types.ObjectId(),
        //     tag: "Default",
        //     emoji: "⭐"
        //   }
        // ],
        activities: [
          {
            action: "contact_created",
            type: "contact",
            title: "Default Contact",
            description: "Default contact created automatically",
            timestamp: new Date(),
          },
        ],
        createdBy: doc._id,
      });
    }

    next();
  } catch (err) {
    console.error("Failed to insert default contact:", err);
    next(err);
  }
});

userSchema.static(
  "matchPasswordAndGenerateToken",
  async function ({ email, phonenumber, countryCode, password }) {
    if (!password || (!email && !phonenumber)) {
      throw new Error("Email or phone number and password are required");
    }

    const query = email
      ? { email }
      : // : { phonenumbers: { $in: [phonenumber] } }; // assuming you store phone numbers as array
        { phonenumbers: { $elemMatch: { countryCode, number: phonenumber } } };

    const user = await this.findOne(query);
    if (!user) throw new Error("User not found");

    const hash = createHmac("sha256", user.salt).update(password).digest("hex");
    if (hash !== user.password) throw new Error("Password not matched");

    return createTokenforUser(user);
  }
);

// userSchema.statics.getNextSerialNumber = async function () {
//   let nextSerial = 0;
//   let formattedSerial = "";

//   while (true) {
//     const result = await this.collection.findOneAndUpdate(
//       { _id: "serial_counter_user" },
//       { $inc: { serialCounter: 1 } },
//       {
//         upsert: true,
//         returnDocument: "after" // Only works in native MongoDB driver v4+
//       }
//     );

//     // Handle result.value possibly being undefined
//     if (!result.value || typeof result.value.serialCounter !== "number") {
//       throw new Error("Failed to generate a new serial number");
//     }

//     nextSerial = result.value.serialCounter;
//     formattedSerial = nextSerial.toString().padStart(3, "0");

//     const existing = await this.findOne({ serialNumber: formattedSerial });
//     if (!existing) break;
//   }

//   return formattedSerial;
// };

userSchema.statics.getNextSerialNumber = async function () {
  const result = await Counter.findByIdAndUpdate(
    { _id: "serial_counter_user" },
    { $inc: { serialCounter: 1 } },
    {
      new: true,
      upsert: true,
    }
  );

  console.log("🔍 Counter update result:", result);

  if (!result || typeof result.serialCounter !== "number") {
    throw new Error("Failed to generate a new serial number");
  }

  return result.serialCounter.toString().padStart(1, "0");
};

const User = model("User", userSchema);
module.exports = User;
