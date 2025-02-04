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
    //   return res.cookie("token", token).redirect("/");
    const user = await User.findOne({ email });

    return res.json({
      status: "success",
      message: "Login successful.",
      data: {
        id: user.id,
        firstname: user.firstname,
        lastname: user.lastname,
        tags: user.tags,
        phonenumbers: user.phonenumbers,
        emailaddress: user.email,
        token: token,
      },
    });
  } catch (error) {
    return res.send({
      error: "Invalid email or password",
    });
  }
};

module.exports = { saveSignupData, processLoginData };
