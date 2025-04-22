// const User = require("../models/userModel");
// const multer = require("multer");
// const path = require("path");
// const fs = require("fs");

// // Configure Multer storage
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     const uploadDir = path.join(__dirname, "../userImages");

//     // Check if the folder exists, if not create it
//     if (!fs.existsSync(uploadDir)) {
//       fs.mkdirSync(uploadDir, { recursive: true });
//     }

//     cb(null, uploadDir);
//   },
//   filename: (req, file, cb) => {
//     const ext = path.extname(file.originalname);
//     cb(null, `${Date.now()}${ext}`);
//   },
// });

// // Multer config with file size limit
// const upload = multer({
//   storage: storage,
//   limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
// }).single("profileImage");

// // Edit Profile Controller
// const editProfile = async (req, res) => {
//   try {
//     upload(req, res, async (err) => {
//       if (err instanceof multer.MulterError) {
//         if (err.code === "LIMIT_FILE_SIZE") {
//           return res.status(413).json({
//             status: "error",
//             message: "File too large. Max size is 10MB.",
//           });
//         }
//         return res
//           .status(500)
//           .json({ status: "error", message: "Image upload failed" });
//       } else if (err) {
//         console.error(err);
//         return res.status(500).json({
//           status: "error",
//           message: "Server error during file upload",
//         });
//       }

//       const { firstname, lastname, countryCode, number, email } = req.body;

//       if (
//         !firstname &&
//         !lastname &&
//         !countryCode &&
//         !number &&
//         !email &&
//         !req.file
//       ) {
//         return res
//           .status(400)
//           .json({ status: "error", message: "No data provided" });
//       }

//       const userId = req.user._id;
//       const user = await User.findById(userId);
//       if (!user) {
//         return res
//           .status(404)
//           .json({ status: "error", message: "User not found" });
//       }

//       if (firstname) user.firstname = firstname;
//       if (lastname) user.lastname = lastname;
//       if (countryCode && number) {
//         user.phonenumber = { countryCode, number };
//       }
//       if (email) user.email = email;

//       if (req.file) {
//         const newImagePath = `/userImages/${req.file.filename}`;

//         // Remove old image if it's not the default
//         if (
//           user.profileImageURL &&
//           user.profileImageURL !== "/public/images/defaultUserPic.png"
//         ) {
//           const oldImagePath = path.join(__dirname, "..", user.profileImageURL);
//           if (fs.existsSync(oldImagePath)) {
//             fs.unlinkSync(oldImagePath);
//           }
//         }

//         user.profileImageURL = newImagePath;
//       } else if (!user.profileImageURL) {
//         user.profileImageURL = "/public/images/defaultUserPic.png";
//       }

//       await user.save();

//       return res.status(200).json({
//         status: "success",
//         message: "Profile updated successfully",
//         data: {
//           id: user._id,
//           firstname: user.firstname,
//           lastname: user.lastname,
//           phonenumber: user.phonenumber,
//           email: user.email,
//           profileImageURL: user.profileImageURL,
//         },
//       });
//     });
//   } catch (error) {
//     console.error("Edit Profile Error:", error);
//     return res.status(500).json({ status: "error", message: "Server error" });
//   }
// };

// module.exports = { editProfile };
const { mongoose } = require("mongoose");
const User = require("../models/userModel");
const s3 = require("../utils/s3");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const path = require("path");


// Edit Profile Controller
const editProfile = async (req, res) => {
  const { firstname, lastname, countryCode, number, email } = req.body;



  // const uploadImageToS3 = async (file) => {
  //   const fileName = `profileImages/${Date.now()}_${file.originalname}`;
  //   const params = {
  //     Bucket: process.env.AWS_BUCKET_NAME,
  //     Key: fileName,
  //     Body: file.buffer,
  //     ContentType: file.mimetype,
  //   };
  //   await s3.upload(params).promise();
  //   return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
  // };

  const uploadImageToS3 = async (file) => {
    console.log("profile image url");
    const ext = path.extname(file.originalname); // e.g., ".jpg"
    const name = path.basename(file.originalname, ext); // e.g., "yash"
    const fileName = `profileImages/${name}_${Date.now()}${ext}`;
    console.log(fileName, "contact image url2");

    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
    };
    console.log(params, "contact image url3");
    const command = new PutObjectCommand(params);
    console.log(command, "contact image url4");
    // await s3.send(command);
    try {
      await s3.send(command);
      console.log("Upload successful!");
    } catch (error) {
      console.error("S3 upload failed:", error);
    }

    console.log("profile image url5");
    console.log(
      "Image uploaded to S3 successfully",
      `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`
    );

    return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
  };

  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    if (firstname) user.firstname = firstname;
    if (lastname) user.lastname = lastname;
    if (countryCode && number) {
      user.phonenumber = { countryCode, number };
    }
    if (email) user.email = email;

    if (req.file) {
      const profileImage = await uploadImageToS3(req.file);
      user.profileImageURL = profileImage;
    } else if (!user.profileImageURL) {
      user.profileImageURL = "/public/images/defaultUserPic.png";
    }

    await user.save();

    return res.status(200).json({
      status: "success",
      message: "Profile updated successfully",
      data: {
        id: user._id,
        firstname: user.firstname,
        lastname: user.lastname,
        phonenumber: user.phonenumber,
        email: user.email,
        profileImageURL: user.profileImageURL,
      },
    });
  } catch (error) {
    console.error("Edit Profile Error:", error);
    return res
      .status(500)
      .json({ status: "error", message: "Server error" });
  }
};

module.exports = { editProfile };