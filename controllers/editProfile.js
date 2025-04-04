// Import required modules
const express = require("express");
const User = require("../models/userModel");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();

// Increase the request size limit for Express
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Folder to store images
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname); // Get file extension
    cb(null, `${Date.now()}${ext}`); // Unique filename with timestamp
  },
});

// Configure Multer upload with file size limit
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Limit file size to 10MB
}).single("profileImage");

// Edit Profile Controller
const editProfile = async (req, res) => {
  try {
    upload(req, res, async (err) => {
      if (err instanceof multer.MulterError) {
        // Multer file size limit error
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({ status: "error", message: "File too large. Max size is 10MB." });
        }
        return res.status(500).json({ status: "error", message: "Image upload failed" });
      } else if (err) {
        return res.status(500).json({ status: "error", message: "Server error during file upload" });
      }

      const { firstname, lastname, phonenumber } = req.body;

      // Check for at least one field to update
      if (!firstname && !lastname && !phonenumber && !req.file) {
        return res.status(400).json({ status: "error", message: "No data provided" });
      }

      // Get user ID from request (adjust according to your auth implementation)
      const userId = req.user._id;

      // Find the user in the database
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ status: "error", message: "User not found" });
      }

      // Update user data
      if (firstname) user.firstname = firstname;
      if (lastname) user.lastname = lastname;
      if (phonenumber) user.phonenumber = phonenumber;

      // Handle profile image update
      if (req.file) {
        const newImagePath = `/uploads/${req.file.filename}`;

        // Delete the old image if it exists and is not the default
        if (user.profileImageURL && user.profileImageURL !== "/public/images/defaultUserPic.png") {
          const oldImagePath = path.join(__dirname, "..", user.profileImageURL);
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        }

        // Save the new image path
        user.profileImageURL = newImagePath;
      } else if (!user.profileImageURL) {
        user.profileImageURL = "/public/images/defaultUserPic.png"; // Set default image if none
      }

      // Save updated user data
      await user.save();

      return res.status(200).json({
        status: "success",
        message: "Profile updated successfully",
        data: {
          id: user._id,
          firstname: user.firstname,
          lastname: user.lastname,
          phonenumber: user.phonenumber,
          profileImageURL: user.profileImageURL,
        },
      });
    });
  } catch (error) {
    console.error("Edit Profile Error:", error);
    return res.status(500).json({ status: "error", message: "Server error" });
  }
};

module.exports = { editProfile };

