const User = require("../models/userModel");

const editProfile = async (req, res) => {
  const { firstname, lastname, mobilenumber } = req.body;

  const userId = req.user._id;

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update the user profile fields
    user.firstname = firstname || user.firstname;
    user.lastname = lastname || user.lastname;
    user.mobilenumber = mobilenumber || user.mobilenumber;

    // Save the updated user
    await user.save();

    return res.status(201).json({
      status: "success",
      message: "Profile updated successfully",
      data: {
        id: user._id,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        mobilenumber: user.mobilenumber,
      },
    });
  } catch (error) {
    console.error(error);
    // return res.status(500).json({ message: "Server error, try again later" });
    return res.send({
      error: "Server error, try again later",
    });
  }
};

module.exports = { editProfile };