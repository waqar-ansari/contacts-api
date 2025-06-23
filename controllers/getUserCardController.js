// const User = require("../models/userModel");

// exports.getUserInfo = async (req, res) => {
//   try {
//     const profileId = req.params.profileId; // e.g., "yash02"

//     if (!profileId) {
//       return res.status(400).json({
//         status: "error",
//         message: "Profile ID is required.",
//       });
//     }

//     // Match letters (firstname) + at least 2 digits (serial)
//     const match = profileId.match(/^([a-zA-Z]+)(\d{2,})$/);

//     if (!match) {
//       return res.status(400).json({
//         status: "error",
//         message: "Invalid profile ID format. Expected format: {firstname}{serialNumber}, e.g., yash02",
//       });
//     }

//     const firstname = match[1];
//     const serialNumber = match[2]; // keep as string

//     const user = await User.findOne({
//       firstname: new RegExp(`^${firstname}$`, "i"), // case-insensitive match
//       serialNumber,
//     }).select("firstname lastname email phonenumbers profileImageURL linkedin designation qrCode instagram twitter facebook telegram");

//     if (!user) {
//       return res.status(404).json({
//         status: "error",
//         message: "User not found",
//       });
//     }

//     user.shareProfileCount = (user.shareProfileCount || 0) + 1;
//     await user.save();

//     console.log(`${user.firstname} shareProfile count: ${user.shareProfileCount}`);
   

//     return res.status(200).json({
//       status: "success",
//       message: "User information retrieved successfully",
//       data: user,
//     });
//   } catch (error) {
//     console.error("Error in getUserInfo:", error);
//     return res.status(500).json({
//       status: "error",
//       message: "Internal server error",
//       error: error.message,
//     });
//   }
// };

const User = require("../models/userModel");

exports.getUserInfo = async (req, res) => {
  try {
    const profileId = req.params.profileId; // e.g., "yash02"

    if (!profileId) {
      return res.status(400).json({
        status: "error",
        message: "Profile ID is required.",
      });
    }

    // Match letters (firstname) + at least 2 digits (serial)
    const match = profileId.match(/^([a-zA-Z]+)(\d{2,})$/);

    if (!match) {
      return res.status(400).json({
        status: "error",
        message: "Invalid profile ID format. Expected format: {firstname}{serialNumber}, e.g., yash02",
      });
    }

    const firstname = match[1];
    const serialNumber = match[2]; // keep as string

    const user = await User.findOne({
      firstname: new RegExp(`^${firstname}$`, "i"), // case-insensitive match
      serialNumber,
    });

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    // ✅ Increment shareProfileCount
    user.shareProfileCount = (user.shareProfileCount || 0) + 1;
    await user.save();

    console.log(`${user.firstname} shareProfile count: ${user.shareProfileCount}`);

    // Select limited fields for response
    const selectedData = {
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email,
      phonenumbers: user.phonenumbers,
      profileImageURL: user.profileImageURL,
      linkedin: user.linkedin,
      designation: user.designation,
      qrCode: user.qrcode,
      instagram: user.instagram,
      twitter: user.twitter,
      facebook: user.facebook,
      telegram: user.telegram,
      shareProfileCount: user.shareProfileCount, // Include this in response
    };

    return res.status(200).json({
      status: "success",
      message: "User information retrieved successfully",
      data: selectedData,
    });
  } catch (error) {
    console.error("Error in getUserInfo:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
};


