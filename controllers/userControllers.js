const User = require("../models/userModel");

const saveSignupData = async (req, res) => {
  const { email, password } = req.body;
  await User.create({ email, password });
  res.status(201).json({ message: "User created successfully" });
};
const processLoginData = async (req, res) => {
  console.log(req.user, "req.user");
  try {
    const { email, password } = req.body;
    const token = await User.matchPasswordAndGenerateToken(email, password);
    //   return res.cookie("token", token).redirect("/");
    const user = await User.findOne({email})
    console.log(user,"user login");
    
    return res.json({
      status: "success",
      message: "Login successful.",
      data: {
        id: user.id,
        firstname: user.firstname,
          lastname: user.lastname,
        emailaddress: user.email,
        mobilenumber: user.mobilenumber,
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
