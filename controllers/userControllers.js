const User = require("../models/userModel");

const saveSignupData = async (req, res) => {
  const { email, password } = req.body;
  await User.create({ email, password });
  res.status(201).json({ message: "User created successfully" });
};
const processLoginData = async (req, res) => {
  try {
    const { email, password } = req.body;
    const token = await User.matchPasswordAndGenerateToken(email, password);

    const user = await User.findOne({ email }).select('-createdAt -updatedAt -__v -salt').lean();
    user.token = token;
    if (user) {
      user.id = user._id;
      delete user._id;
    }
    if (user && user.tags) {
      user.tags.forEach(tag => {
        delete tag._id; // Remove _id from each tag in the tags array
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
