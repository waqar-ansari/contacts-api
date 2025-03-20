const User = require("../models/userModel");

const deleteUser = async (req, res) => {
  try {
    const id = req.user._id;

    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res
        .status(404)
        .json({ status: "error" , message: "User not found"});
    }
    res
      .status(200)
      .json({ status: "success" , message: "User Deleted Successfully"});
  } catch {
    res
      .status(500)
      .json({status: "error", message: "Error deleting contact" });
  }
};

module.exports = { deleteUser };
