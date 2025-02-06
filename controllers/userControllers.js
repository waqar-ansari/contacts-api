const User = require("../models/userModel");
const Contact = require("../models/contactModel");
const { checkForAuthentication } = require("../middlewares/authentication");
const { Schema } = require("mongoose");

const saveSignupData = async (req, res) => {
  const { email, password } = req.body;
  await User.create({ email, password });
  res.status(201).json({ message: "User created successfully" });
};
const processLoginData = async (req, res) => {
  try {
    const { email, password } = req.body;
    const token = await User.matchPasswordAndGenerateToken(email, password);

    const user = await User.findOne({ email })
      .select("-createdAt -updatedAt -__v -salt")
      .lean();

    const contactCount = await Contact.countDocuments({ createdBy: user._id });
    const favouriteCount = await Contact.countDocuments({
      createdBy: user._id,
      isFavourite: true,
    });

    const tagCountValue = await User.aggregate([
      { $match: { _id: user._id } },
      { $unwind: "$tags" },
      { $count: "tagCount" },
    ]);

    const tagCount = tagCountValue.length > 0 ? tagCountValue[0].tagCount : 0;

    user.contactCount = contactCount;
    user.favouriteCount = favouriteCount;
    user.tagCount = tagCount;

    user.token = token;
    if (user) {
      user.id = user._id;
      delete user._id;
    }
    if (user && user.tags) {
      user.tags.forEach((tag) => {
        delete tag._id;
      });
    }
    return res.json({
      status: "success",
      message: "Login successful.",
      user,
    });
  } catch (error) {
    return res.send({
      error: "Invalid email or password",
    });
  }
};

module.exports = { saveSignupData, processLoginData };
