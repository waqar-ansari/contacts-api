const { createHmac, randomBytes } = require("crypto");
const { Schema, model, mongoose } = require("mongoose");
const Contact = require("./contactModel"); // Adjust path if needed

const userSchema = new Schema(
  {


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

    isActive: {
      type: Boolean,
      default: false, // user is inactive until login
    },

    lastSeen: { type: Date, default: null },

    // tags: {
    //   type: [
    //     {
    //       _id: false,
    //       tag_id: {
    //         type: mongoose.Schema.Types.ObjectId,
    //         default: () => new mongoose.Types.ObjectId(),
    //       },
    //       tag: {
    //         type: String,
    //       },
    //       emoji: {
    //         type: String, // emoji
    //       },
    //       order: {
    //         type: Number, // New field
    //       },
    //     },
    //   ],
    //   default: () => [
    //     {
    //       tag_id: new mongoose.Types.ObjectId(),
    //       tag: "Family",
    //       emoji: "🖤",
    //     },
    //     {
    //       tag_id: new mongoose.Types.ObjectId(),
    //       tag: "Networking",
    //       emoji: "🤝",
    //     },
    //     {
    //       tag_id: new mongoose.Types.ObjectId(),
    //       tag: "Coworkers",
    //       emoji: "💼",
    //     },
    //     {
    //       tag_id: new mongoose.Types.ObjectId(),
    //       tag: "Friends",
    //       emoji: "⚽",
    //     },
    //   ],
    // },

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
            default: "🏷️",
          },
          order: {
            type: Number, // New field
          },
        },
      ],
      default: () => [
        {
          tag_id: new mongoose.Types.ObjectId(),
          tag: "Family",
          emoji: "🖤",
          order: 1,
        },
        {
          tag_id: new mongoose.Types.ObjectId(),
          tag: "Networking",
          emoji: "🤝",
          order: 2,
        },
        {
          tag_id: new mongoose.Types.ObjectId(),
          tag: "Coworkers",
          emoji: "💼",
          order: 3,
        },
        {
          tag_id: new mongoose.Types.ObjectId(),
          tag: "Friends",
          emoji: "⚽",
          order: 4,
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
      /////user id of user who referred this user
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

    // Stripe subscription fields
    stripeCustomerId: {
      type: String,
      sparse: true, // only enforce uniqueness when present
    },

    userSubscribed: {
      type: Boolean,
      default: true,
    },

    // userModel.js (schema additions)
    oneSignalPlayerIds: [{ type: String }], // optional - store device/player ids
    oneSignalExternalUserIds: [{ type: String }], // recommended - store phone-based external ids like "919876543210"

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

    // Cache for referral credits before they're applied to Stripe
    cache_credits: {
      type: Number,
      default: 0,
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


const User = model("User", userSchema);
module.exports = User;
