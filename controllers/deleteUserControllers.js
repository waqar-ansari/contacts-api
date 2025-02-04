const User = require("../models/userModel");

const deleteUser = async (req, res) => {
  try {
    const { id } = req.body;
    const user = await User.findByIdAndDelete(id);
    res.status(200).json({ message: "User Deleted Successfully" });
  } catch {
    res.status(500).json({ message: "Error deleting contact" });
  }
};

module.exports = { deleteUser };
