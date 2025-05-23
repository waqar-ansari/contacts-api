// // const User = require("../models/userModel");
// // const multer = require("multer");
// // const path = require("path");
// // const fs = require("fs");

// // // Configure Multer storage
// // const storage = multer.diskStorage({
// //   destination: (req, file, cb) => {
// //     const uploadDir = path.join(__dirname, "../userImages");

// //     // Check if the folder exists, if not create it
// //     if (!fs.existsSync(uploadDir)) {
// //       fs.mkdirSync(uploadDir, { recursive: true });
// //     }

// //     cb(null, uploadDir);
// //   },
// //   filename: (req, file, cb) => {
// //     const ext = path.extname(file.originalname);
// //     cb(null, `${Date.now()}${ext}`);
// //   },
// // });

// // // Multer config with file size limit
// // const upload = multer({
// //   storage: storage,
// //   limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
// // }).single("profileImage");

// // // Edit Profile Controller
// // const editProfile = async (req, res) => {
// //   try {
// //     upload(req, res, async (err) => {
// //       if (err instanceof multer.MulterError) {
// //         if (err.code === "LIMIT_FILE_SIZE") {
// //           return res.status(413).json({
// //             status: "error",
// //             message: "File too large. Max size is 10MB.",
// //           });
// //         }
// //         return res
// //           .status(500)
// //           .json({ status: "error", message: "Image upload failed" });
// //       } else if (err) {
// //         console.error(err);
// //         return res.status(500).json({
// //           status: "error",
// //           message: "Server error during file upload",
// //         });
// //       }

// //       const { firstname, lastname, countryCode, number, email } = req.body;

// //       if (
// //         !firstname &&
// //         !lastname &&
// //         !countryCode &&
// //         !number &&
// //         !email &&
// //         !req.file
// //       ) {
// //         return res
// //           .status(400)
// //           .json({ status: "error", message: "No data provided" });
// //       }

// //       const userId = req.user._id;
// //       const user = await User.findById(userId);
// //       if (!user) {
// //         return res
// //           .status(404)
// //           .json({ status: "error", message: "User not found" });
// //       }

// //       if (firstname) user.firstname = firstname;
// //       if (lastname) user.lastname = lastname;
// //       if (countryCode && number) {
// //         user.phonenumber = { countryCode, number };
// //       }
// //       if (email) user.email = email;

// //       if (req.file) {
// //         const newImagePath = `/userImages/${req.file.filename}`;

// //         // Remove old image if it's not the default
// //         if (
// //           user.profileImageURL &&
// //           user.profileImageURL !== "/public/images/defaultUserPic.png"
// //         ) {
// //           const oldImagePath = path.join(__dirname, "..", user.profileImageURL);
// //           if (fs.existsSync(oldImagePath)) {
// //             fs.unlinkSync(oldImagePath);
// //           }
// //         }

// //         user.profileImageURL = newImagePath;
// //       } else if (!user.profileImageURL) {
// //         user.profileImageURL = "/public/images/defaultUserPic.png";
// //       }

// //       await user.save();

// //       return res.status(200).json({
// //         status: "success",
// //         message: "Profile updated successfully",
// //         data: {
// //           id: user._id,
// //           firstname: user.firstname,
// //           lastname: user.lastname,
// //           phonenumber: user.phonenumber,
// //           email: user.email,
// //           profileImageURL: user.profileImageURL,
// //         },
// //       });
// //     });
// //   } catch (error) {
// //     console.error("Edit Profile Error:", error);
// //     return res.status(500).json({ status: "error", message: "Server error" });
// //   }
// // };

const path = require("path");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const User = require("../models/userModel");
const s3 = require("../utils/s3");
const mongoose = require("mongoose");


const uploadImageToS3 = async (file) => {
  const ext = path.extname(file.originalname);
  const name = path.basename(file.originalname, ext);
  const fileName = `profileImages/${name}_${Date.now()}${ext}`;

  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: fileName,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  const command = new PutObjectCommand(params);
  await s3.send(command);

  return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
};

const editProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      firstname,
      lastname,
      email,
      phonenumbers,
      whatsappTemplate_id,
      whatsappTemplateTitle,
      whatsappTemplateMessage,
      whatsappTemplateIsFavourite,
      emailTemplate_id,
      emailTemplateTitle,
      emailTemplateSubject,
      emailTemplateBody,
      emailTemplateIsFavourite,
    } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ status: "error", message: "User not found" });
    }

    // --- Basic Info ---
    if (firstname) user.firstname = firstname;
    if (lastname) user.lastname = lastname;
    if (email) user.email = email;

    if (phonenumbers) {
      try {
        user.phonenumbers = JSON.parse(phonenumbers);
      } catch {
        user.phonenumbers = Array.isArray(phonenumbers) ? phonenumbers : [phonenumbers];
      }
    }

    // --- Upload Profile Image ---
    if (req.file) {
      const profileImage = await uploadImageToS3(req.file);
      user.profileImageURL = profileImage;
    } else if (!user.profileImageURL) {
      user.profileImageURL = "/public/images/defaultUserPic.png";
    }

    // === WhatsApp Template: Add or Edit ===
    if (whatsappTemplateTitle || whatsappTemplateMessage || whatsappTemplate_id || typeof whatsappTemplateIsFavourite !== 'undefined') {
      if (whatsappTemplate_id) {
        const index = user.whatsappTemplates.findIndex(
          (tpl) => tpl.whatsappTemplate_id?.toString() === whatsappTemplate_id.toString()
        );
        if (index !== -1) {
          if (whatsappTemplateTitle) user.whatsappTemplates[index].whatsappTemplateTitle = whatsappTemplateTitle;
          if (whatsappTemplateMessage) user.whatsappTemplates[index].whatsappTemplateMessage = whatsappTemplateMessage;
          if (typeof whatsappTemplateIsFavourite !== 'undefined') {
            user.whatsappTemplates[index].whatsappTemplateIsFavourite = whatsappTemplateIsFavourite;
          }
        } else {
          return res.status(404).json({ status: "error", message: "WhatsApp template not found" });
        }
      } else {
        user.whatsappTemplates.unshift({
          whatsappTemplate_id: new mongoose.Types.ObjectId(),
          whatsappTemplateTitle,
          whatsappTemplateMessage,
          whatsappTemplateIsFavourite: typeof whatsappTemplateIsFavourite === 'boolean' ? whatsappTemplateIsFavourite : false,
        });
      }
    }

    // === Email Template: Add or Edit ===
    if (emailTemplateTitle || emailTemplateSubject || emailTemplateBody || emailTemplate_id || typeof emailTemplateIsFavourite !== 'undefined') {
      if (emailTemplate_id) {
        const index = user.emailTemplates.findIndex(
          (tpl) => tpl.emailTemplate_id?.toString() === emailTemplate_id.toString()
        );
        if (index !== -1) {
          if (emailTemplateTitle) user.emailTemplates[index].emailTemplateTitle = emailTemplateTitle;
          if (emailTemplateSubject) user.emailTemplates[index].emailTemplateSubject = emailTemplateSubject;
          if (emailTemplateBody) user.emailTemplates[index].emailTemplateBody = emailTemplateBody;
          if (typeof emailTemplateIsFavourite !== 'undefined') {
            user.emailTemplates[index].emailTemplateIsFavourite = emailTemplateIsFavourite;
          }
        } else {
          return res.status(404).json({ status: "error", message: "Email template not found" });
        }
      } else {
        user.emailTemplates.unshift({
          emailTemplate_id: new mongoose.Types.ObjectId(),
          emailTemplateTitle,
          emailTemplateSubject,
          emailTemplateBody,
          emailTemplateIsFavourite: typeof emailTemplateIsFavourite === 'boolean' ? emailTemplateIsFavourite : false,
        });
      }
    }

    await user.save();

    return res.status(200).json({
      status: "success",
      message: "Profile updated successfully",
      data: {
        id: user._id,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        phonenumbers: user.phonenumbers,
        profileImageURL: user.profileImageURL,
        whatsappTemplates: user.whatsappTemplates,
        emailTemplates: user.emailTemplates,
      },
    });
  } catch (error) {
    console.error("Edit Profile Error:", error);
    return res.status(500).json({ status: "error", message: "Server error" });
  }
};



module.exports = { editProfile };
