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

    const data = await User.findOne({ email })
      .select("-createdAt -updatedAt -__v -salt")
      .lean();
    console.log(data, "data for login");

    const contactCount = await Contact.countDocuments({ createdBy: data._id });
    const favouriteCount = await Contact.countDocuments({
      createdBy: data._id,
      isFavourite: true,
    });

    const tagCountValue = await User.aggregate([
      { $match: { _id: data._id } },
      { $unwind: "$tags" },
      { $count: "tagCount" },
    ]);

    const tagCount = tagCountValue.length > 0 ? tagCountValue[0].tagCount : 0;

    data.contactCount = contactCount;
    data.favouriteCount = favouriteCount;
    data.tagCount = tagCount;

    data.token = token;
    if (data) {
      data.id = data._id;
      delete data._id;
    }
    if (data && data.tags) {
      data.tags.forEach((tag) => {
        delete tag._id;
      });
    }
    return res.json({
      status: "success",
      message: "Login successful.",
      data,
    });
  } catch (error) {
    return res.json({
      error: "Invalid email or password",
    });
  }
};

module.exports = { saveSignupData, processLoginData };
