const { createHmac, randomBytes } = require("crypto");
const { Schema, model, mongoose } = require("mongoose");
const { createTokenforUser } = require("../services/authentication");

const userSchema = new Schema(
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
      required: true,
      unique: true,
    },
    tags: [
      {
        _id: { type: Boolean, default: false },
        tag_id: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
          unique: true,
        },
        tag: {
          type: String,
          required: true,
        },
      },
    ],
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
    salt: {
      type: String,
      // required: true,
    },
    password: {
      type: String,
      required: true,
    },

    profileImageURL: {
      type: String,
      default: "/images/defaultUserPic.png",
    },
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

userSchema.static(
  "matchPasswordAndGenerateToken",
  async function (email, password) {
    const user = await this.findOne({ email });

    if (!user) throw new Error("User not found"); // it will return false if user not found
    const salt = user.salt;
    const hashedPassword = user.password;
    const userProvidedHash = createHmac("sha256", salt)
      .update(password)
      .digest("hex");
    if (hashedPassword !== userProvidedHash)
      throw new Error("Password not matched"); // it will return false if password not matched
    const token = createTokenforUser(user);
    return token; // return token if password matched
  }
);

const User = model("User", userSchema);
module.exports = User;
