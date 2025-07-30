// const User = require("../models/userModel");
// const Contact = require("../models/contactModel");

// const deleteUser = async (req, res) => {
//   try {
//     const userId = req.user._id;

//     // Delete user
//     const user = await User.findByIdAndDelete(userId);
//     if (!user) {
//       return res.status(404).json({
//         status: "error",
//         message: "User not found",
//       });
//     }

//     // Delete all contacts created by this user
//     await Contact.deleteMany({ createdBy: userId });

//     res.status(200).json({
//       status: "success",
//       message: "User and all associated contacts deleted successfully",
//     });
//   } catch (error) {
//     console.error("Error deleting user and contacts:", error);
//     res.status(500).json({
//       status: "error",
//       message: "Error deleting user and associated data",
//     });
//   }
// };

// module.exports = { deleteUser };

const User = require("../models/userModel");
const Contact = require("../models/contactModel");

const deleteUser = async (req, res) => {
  try {
    const userId = req.user._id;

    // Step 1: Find and delete the user
    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    const userEmail = user.email?.toLowerCase()?.trim();
    const userPhone = user.phonenumber?.trim();

    // Step 2: Delete all contacts created by this user
    await Contact.deleteMany({ createdBy: userId });

    // Step 3: Delete contacts in other users' data where both email and phone match
    await Contact.deleteMany({
      createdBy: { $ne: userId }, // Ensure not deleting from own records (already done)
      email: userEmail,
      phonenumber: userPhone
    });

    // Step 4: Remove this user from other users' iScanned arrays (if such logic exists)
    await User.updateMany(
      {
        _id: { $ne: userId },
        iScanned: {
          $elemMatch: { email: userEmail, phonenumber: userPhone }
        }
      },
      {
        $pull: {
          iScanned: { email: userEmail, phonenumber: userPhone }
        }
      }
    );

    res.status(200).json({
      status: "success",
      message: "User and all associated references deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting user and references:", error);
    res.status(500).json({
      status: "error",
      message: "Error deleting user and associated data",
    });
  }
};

module.exports = { deleteUser };


