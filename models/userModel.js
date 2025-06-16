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

const OtpSchema = new mongoose.Schema({
  email: { type: String },
  otp: { type: String },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300, // auto-delete after 5 mins
  },
});

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

    Otp: [OtpSchema],

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
        icon: {
          type: String, // Will now hold emoji character
        },
      },
    ],
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

    profileImageURL: {
      type: String,
      default: "/images/defaultUserPic.png",
    },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    iScanned: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    scannedMe: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
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
