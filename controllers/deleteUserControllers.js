// const User = require("../models/userModel");

// const deleteUser = async (req, res) => {
//   try {
//     const id = req.user._id;

//     const user = await User.findByIdAndDelete(id);
//     if (!user) {
//       return res
//         .status(404)
//         .json({ status: "error" , message: "User not found"});
//     }
//     res
//       .status(200)
//       .json({ status: "success" , message: "User Deleted Successfully"});
//   } catch {
//     res
//       .status(500)
//       .json({status: "error", message: "Error deleting contact" });
//   }
// };

// module.exports = { deleteUser };

const User = require("../models/userModel");
const Contact = require("../models/contactModel");

const deleteUser = async (req, res) => {
  try {
    const userId = req.user._id;

    // Delete user
    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    // Delete all contacts created by this user
    await Contact.deleteMany({ createdBy: userId });

    res.status(200).json({
      status: "success",
      message: "User and all associated contacts deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting user and contacts:", error);
    res.status(500).json({
      status: "error",
      message: "Error deleting user and associated data",
    });
  }
};

module.exports = { deleteUser };

