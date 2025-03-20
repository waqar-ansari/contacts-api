const User = require("../models/userModel");

const deleteUser = async (req, res) => {
  try {
    const id = req.user._id;

    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found", status: "error" });
    }
    res
      .status(200)
      .json({ message: "User Deleted Successfully", status: "success" });
  } catch {
    res
      .status(500)
      .json({ message: "Error deleting contact", status: "error" });
  }
};

module.exports = { deleteUser };
