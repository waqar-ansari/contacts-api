// const { mongoose } = require("mongoose");
// const User = require("../models/userModel");
// const s3 = require("../utils/s3");
// const { PutObjectCommand } = require("@aws-sdk/client-s3");
// const path = require("path");

// // const addTags = async (req, res) => {
// //   try {
// //     const { tag } = req.body;

// //     if (!tag || !Array.isArray(tag) || tag.length === 0) {
// //       return res
// //         .status(400)
// //         .json({ status: "error", message: "Please provide an array of tags" });
// //     }

// //     const user = await User.findById(req.user._id);
// //     if (!user) {
// //       return res
// //         .status(404)
// //         .json({ status: "error", message: "User not found" });
// //     }

// //     // Normalize input tags
// //     const inputTags = tag.map(t => t.trim().toLowerCase());

// //     // Get existing tag values from the user
// //     const existingTags = user.tags.map(t => t.tag.toLowerCase());

// //     const newTags = [];

// //     inputTags.forEach(t => {
// //       if (!existingTags.includes(t)) {
// //         const newTag = {
// //           tag: t,
// //           tag_id: new mongoose.Types.ObjectId(),
// //         };
// //         user.tags.push(newTag);
// //         newTags.push(newTag);
// //       }
// //     });

// //     if (newTags.length > 0) {
// //       await user.save();
// //     }

// //     res.status(200).json({
// //       status: "success",
// //       message: "tag added successfully",
// //       data: newTags,
// //     });

// //   } catch (error) {
// //     console.error("Add Tags Error:", error);
// //     res.status(500).json({ status: "error", message: "Error adding tags" , "error": error});
// //   }
// // };

// const uploadImageToS3 = async (file) => {
//   const ext = path.extname(file.originalname);
//   const name = path.basename(file.originalname, ext);
//   const fileName = `tagIcons/${name}_${Date.now()}${ext}`;

//   const params = {
//     Bucket: process.env.AWS_BUCKET_NAME,
//     Key: fileName,
//     Body: file.buffer,
//     ContentType: file.mimetype,
//   };

//   const command = new PutObjectCommand(params);
//   await s3.send(command);

//   return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
// };

// const addTags = async (req, res) => {
//   try {
//     const { tag } = req.body;
//     console.log("Received tags:", tag);

//     if (!tag || !Array.isArray(tag) || tag.length === 0) {
//       return res
//         .status(400)
//         .json({ status: "error", message: "Please provide an array of tags" });
//     }

//     const user = await User.findById(req.user._id);
//     if (!user) {
//       return res
//         .status(404)
//         .json({ status: "error", message: "User not found" });
//     }

//     // Normalize input tags
//     const inputTags = tag.map(t => t.trim().toLowerCase());

//     // Get existing tag values from the user
//     const existingTags = user.tags.map(t => t.tag.toLowerCase());

//     const newTags = [];

//     inputTags.forEach(t => {
//       if (!existingTags.includes(t)) {
//         const newTag = {
//           tag: t,
//           tag_id: new mongoose.Types.ObjectId(),
//         };
//         user.tags.push(newTag);
//         newTags.push(newTag);
//       }
//     });

//     // STEP 3: Handle icons from req.files
//     let iconFiles = [];

//     if (req.files && req.files.icons) {
//       if (Array.isArray(req.files.icons)) {
//         iconFiles = req.files.icons;
//       } else {
//         iconFiles = [req.files.icons];
//       }
//     }

//     // const existingTags = user.tags.map(t => t.tag.toLowerCase());
//     // const newTags = [];

//     for (let i = 0; i < tagsArray.length; i++) {
//       const tagText = tagsArray[i].trim().toLowerCase();

//       if (!existingTags.includes(tagText)) {
//         let iconUrl = null;

//         if (iconFiles[i]) {
//           iconUrl = await uploadImageToS3(iconFiles[i]);
//         }

//         const newTag = {
//           tag: tagText,
//           tag_id: new mongoose.Types.ObjectId(),
//           icon: iconUrl,
//         };

//         user.tags.push(newTag);
//         newTags.push(newTag);
//       }
//     }

//     if (newTags.length > 0) {
//       await user.save();
//     }

//     res.status(200).json({
//       status: "success",
//       message: "tag added successfully",
//       data: newTags,
//     });

//   } catch (error) {
//     console.error("Add Tags Error:", error);
//     res.status(500).json({ status: "error", message: "Error adding tags" , "error": error});
//   }
// };


// // const addTags = async (req, res) => {
// //   console.log(req.body.tag);

// //   try {
// //     // STEP 1: Parse tag array from string
// //     let tagsArray = [];

// //     if (typeof req.body.tag === "string") {
// //       try {

// //         tagsArray = JSON.parse(req.body.tag);
// //         if (!Array.isArray(tagsArray)) {
// //           return res.status(400).json({ status: "error", message: "Tags must be a JSON array" });
// //         }
// //       } catch (err) {
// //         return res.status(400).json({ status: "error", message: "Invalid JSON format in tag field" });
// //       }
// //     }

// //     if (!tagsArray.length) {
// //       return res.status(400).json({ status: "error", message: "Please provide tags array" });
// //     }

// //     // STEP 2: Validate user
// //     const user = await User.findById(req.user._id);
// //     if (!user) {
// //       return res.status(404).json({ status: "error", message: "User not found" });
// //     }

// //     // STEP 3: Handle icons from req.files
// //     let iconFiles = [];

// //     if (req.files && req.files.icons) {
// //       if (Array.isArray(req.files.icons)) {
// //         iconFiles = req.files.icons;
// //       } else {
// //         iconFiles = [req.files.icons];
// //       }
// //     }

// //     const existingTags = user.tags.map(t => t.tag.toLowerCase());
// //     const newTags = [];

// //     for (let i = 0; i < tagsArray.length; i++) {
// //       const tagText = tagsArray[i].trim().toLowerCase();

// //       if (!existingTags.includes(tagText)) {
// //         let iconUrl = null;

// //         if (iconFiles[i]) {
// //           iconUrl = await uploadImageToS3(iconFiles[i]);
// //         }

// //         const newTag = {
// //           tag: tagText,
// //           tag_id: new mongoose.Types.ObjectId(),
// //           icon: iconUrl,
// //         };

// //         user.tags.push(newTag);
// //         newTags.push(newTag);
// //       }
// //     }

// //     if (newTags.length > 0) {
// //       await user.save();
// //     }

// //     return res.status(200).json({
// //       status: "success",
// //       message: "Tags added successfully",
// //       data: newTags,
// //     });

// //   } catch (error) {
// //     console.error("Add Tags Error:", error);
// //     return res.status(500).json({
// //       status: "error",
// //       message: "Error adding tags",
// //       error: error.message || error,
// //     });
// //   }
// // };


// module.exports = { addTags };


const { mongoose } = require("mongoose");
const User = require("../models/userModel");

const addTags = async (req, res) => {
  try {
    const tagsArray = req.body;

    // ✅ Validate array
    if (!Array.isArray(tagsArray) || tagsArray.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "Please provide an array of tags",
      });
    }

    // ✅ Find user
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    // ✅ Normalize existing tags
    const existingTags = user.tags.map((t) => t.tag.toLowerCase());

    const newTags = [];
    const skippedTags = [];

    for (const item of tagsArray) {
      const tagText = item.tag?.trim().toLowerCase();
      const emoji = item.emoji || "";

      if (!tagText) continue;

      if (existingTags.includes(tagText)) {
        skippedTags.push(tagText);
        continue;
      }

      const newTag = {
        tag: tagText,
        tag_id: new mongoose.Types.ObjectId(),
        icon: emoji, // emoji saved in "icon" field
      };

      user.tags.push(newTag);
      newTags.push(newTag);
    }

    if (newTags.length > 0) {
      await user.save();
    }

    return res.status(200).json({
      status: "success",
      message: "Tags added successfully",
      data: newTags,
      // skipped: skippedTags,
    });
  } catch (error) {
    console.error("Add Tags Error:", error);
    return res.status(500).json({
      status: "error",
      message: "Error adding tags",
      error: error.message,
    });
  }
};

module.exports = { addTags };

