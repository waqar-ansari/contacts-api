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

    whatsappTemplates: [whatsappTemplateSchema],

    emailTemplates: [emailTemplateSchema],

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
    email: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      // default: null, // ✅ makes sure null is used instead of ""
    },
    emailVerificationToken: String,
    isVerified: { type: Boolean, default: false },
    // tags: [
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
      companyName: {
        type: String,
        default: ""
      },
      isFirstCRM: {
        type: Boolean,
        default: false
      },
      industry: {
        type: String,
        enum: ["Agency", "Real Estate", "Software/Technology", "Financial Services"],
        default: "Agency" // or any of the valid options
      }
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

    qrCode: { type: String },


    profileImageURL: {
      type: String,
      default: "https://contacts-api-bucket.s3.eu-north-1.amazonaws.com/profileImages/defaultImage.jpeg",
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
