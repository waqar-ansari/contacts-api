// const jwt = require("jsonwebtoken");
// const User = require("../models/userModel");
// const Contact = require("../models/contactModel");
// const BlacklistedToken = require("../models/blacklistedTokenModel");

// const deleteUser = async (req, res) => {
//   try {
//     const userId = req.user._id || req.user.id;
//     const token = req.token || (req.headers.authorization?.split(" ")[1]);

//     // ✅ Safely compute token expiry
//     let expiresAt;
//     if (token) {
//       const decoded = jwt.decode(token);
//       if (decoded && decoded.exp) {
//         expiresAt = new Date(decoded.exp * 1000);
//       } else {
//         // fallback: set it to 1 hour from now if no exp present
//         expiresAt = new Date(Date.now() + 60 * 60 * 1000);
//       }

//       // ✅ Blacklist this token
//       await BlacklistedToken.create({ token, userId, expiresAt });
//     }

//     // ✅ Delete related data
//     await Contact.deleteMany({ createdBy: userId });
//     await User.findByIdAndDelete(userId);

//     return res.json({ message: "User deleted" });
//   } catch (error) {
//     console.error("Delete user error:", error);
//     return res.status(500).json({ message: "Error deleting user", error: error.message });
//   }
// };

// module.exports = { deleteUser };

const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const Contact = require("../models/contactModel");
const BlacklistedToken = require("../models/blacklistedTokenModel");
const s3 = require("../utils/s3");
const { DeleteObjectCommand } = require("@aws-sdk/client-s3");

const deleteImageFromS3 = async (imageUrl) => {
  try {
    if (!imageUrl) return;

    // Extract the Key from the URL
    const urlParts = imageUrl.split(".amazonaws.com/");
    if (urlParts.length < 2) return; // not a valid S3 URL

    const fileKey = urlParts[1]; // profileImages/filename.jpg

    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: fileKey,
    };

    const command = new DeleteObjectCommand(params);
    await s3.send(command);

    console.log(`✅ Deleted from S3: ${fileKey}`);
  } catch (err) {
    console.error("Failed to delete from S3:", err);
  }
};

// ======================
// DELETE USER CONTROLLER
// ======================
exports.deleteUser = async (req, res) => {
  try {
    const userId = req.user._id;

    // 1️⃣ Fetch user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ status: "fail", message: "User not found" });
    }

    // 2️⃣ Delete user's profile image from S3 (using helper)
    if (user.profileImageURL) {
      await deleteImageFromS3(user.profileImageURL);
    }

    // 3️⃣ Delete associated data (add all collections linked by userId)
    await Promise.all([
      Contact.deleteMany({ owner: userId }),
      // Add other deletions if you have e.g., QRScan, BusinessCard, etc.
    ]);

    // 4️⃣ Delete the user document itself
    await User.findByIdAndDelete(userId);

    // 5️⃣ Blacklist the token so it becomes invalid
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.decode(token);
      const expiresAt = decoded?.exp
        ? new Date(decoded.exp * 1000)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // fallback 7 days

      await BlacklistedToken.create({
        token,
        userId,
        expiresAt,
      });
    }

    // 6️⃣ Send success response
    return res.status(200).json({
      status: "success",
      message: "User, image, and all related data deleted successfully",
    });
  } catch (err) {
    console.error("❌ deleteUser error:", err);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};
