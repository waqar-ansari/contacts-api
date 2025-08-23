const User = require("../models/userModel");

exports.getUserInfo = async (req, res) => {
  try {
    const profileId = req.params.profileId; // e.g., "ya sh02"

    if (!profileId) {
      return res.status(400).json({
        status: "error",
        message: "Profile ID is required.",
      });
    }

    // Match everything up to the last 2+ digits (even with spaces)
    const match = profileId.match(/^(.+?)(\d{2,})$/);

    if (!match) {
      return res.status(400).json({
        status: "error",
        message: "Invalid profile ID format. Expected format: {firstname}{serialNumber}, e.g., 'ya sh02'",
      });
    }

    // let rawFirstname = match[1];        // With spaces
    // const serialNumber = match[2];      // e.g., "02"

    // const firstname = rawFirstname.trim().replace(/\s+/g, " "); // Normalize spaces

    // const user = await User.findOne({
    //   firstname: new RegExp(`^${firstname}$`, "i"), // case-insensitive match with spaces
    //   serialNumber,
    // });

    let rawFirstname = match[1];
    const serialNumber = match[2];

    // ✅ Remove all spaces for comparison (frontend sends without spaces)
    const normalizedFirstname = rawFirstname.replace(/\s+/g, "").toLowerCase();

    const user = await User.findOne({
      // compare firstname after removing spaces
      $expr: {
        $and: [
          { $eq: [{ $replaceAll: { input: { $toLower: "$firstname" }, find: " ", replacement: "" } }, normalizedFirstname] },
          { $eq: ["$serialNumber", serialNumber] }
        ]
      }
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

    const selectedData = {
      id: user._id,
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
      shareProfileCount: user.shareProfileCount,
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



