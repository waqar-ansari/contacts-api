// const { mongoose } = require("mongoose");
// const Contact = require("../models/contactModel");

// const addEditContact = async (req, res) => {
//   const {
//     contact_id,
//     firstname,
//     lastname,
//     emailaddresses,
//     phonenumbers,
//     contactImageURL,
//     isFavourite,
//     tags,
//   } = req.body;

//   try {
//     let data;
//     if (contact_id === "0") {
//       data = await Contact.create({
//         firstname,
//         lastname,
//         emailaddresses,
//         phonenumbers,
//         contactImageURL,
//         isFavourite,
//         tags,
//         createdBy: req.user._id,
//       });
//       data.contact_id = data._id;
//       await data.save();

//       res.status(201).json({
//         status: "success",
//         message: "Contact created successfully",
//       });
//     } else {

//       data = await Contact.findOneAndUpdate(
//         { _id: contact_id, createdBy: req.user._id },
//         {
//           firstname,
//           lastname,
//           emailaddresses,
//           phonenumbers,
//           contactImageURL,
//           isFavourite,
//           tags,
//         },
//         { new: true }
//       ).populate("createdBy");

//       if (!data) {
//         return res
//           .status(404)
//           .json({
//             status: "error",
//             message: "Contact not found or unauthorized access",
//           });
//       }

//       res.status(200).json({
//         status: "success",
//         message: "Contact updated successfully",
//       });
//     }
//   } catch (error) {
//     res.status(500).json({ status: "error", message: "An error occurred" });
//   }
// };

// module.exports = { addEditContact };

const { mongoose } = require("mongoose");
const Contact = require("../models/contactModel");
const User = require("../models/userModel");
const s3 = require("../utils/s3");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const path = require("path");

const addEditContact = async (req, res) => {
  const {
    contact_id,
    firstname,
    lastname,
    emailaddresses,
    phonenumbers,
    isFavourite,
    notes,
    website,
  } = req.body;

  // Parse tags (expected in form-data as stringified JSON array)
  let tagsArray = [];
  try {
    tagsArray = JSON.parse(req.body.tags || "[]");
  } catch (err) {
    return res.status(400).json({
      status: "error",
      message: "Tags must be a valid JSON array of strings.",
    });
  }

    // const uploadImageToS3 = async (file) => {
  //   const fileName = `contactImages/${Date.now()}_${file.originalname}`;
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
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    const fileName = `contactImages/${name}_${Date.now()}${ext}`;

    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    try {
      await s3.send(new PutObjectCommand(params));
      return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
    } catch (error) {
      console.error("S3 upload failed:", error);
      throw new Error("Image upload failed");
    }
  };

  try {
    // Match user tags
    const user = await User.findById(req.user._id);
    if (!user) return res.status(401).json({ status: "error", message: "User not found" });

    const matchedTags = user.tags
      .filter((tagObj) => tagsArray.includes(tagObj.tag))
      .map((tagObj) => ({
        tag_id: tagObj.tag_id,
        tag: tagObj.tag,
      }));

    let contactImage = "";
    if (req.file) {
      contactImage = await uploadImageToS3(req.file);
    }

    let contactData;
    if (!contact_id || contact_id === "0") {
      // Create contact
      contactData = await Contact.create({
        firstname,
        lastname,
        emailaddresses,
        phonenumbers,
        contactImageURL: contactImage,
        isFavourite,
        tags: matchedTags,
        notes,
        website,
        createdBy: req.user._id,
      });

      contactData.contact_id = contactData._id;
      await contactData.save();

      const responseData = contactData.toObject();
      const tag = responseData.tags.map(tag => tag.tag);
      responseData.tags = tag;

      delete responseData.createdBy;
      delete responseData._id;
      delete responseData.createdAt;
      delete responseData.updatedAt;
      delete responseData.__v;

      return res.status(201).json({
        status: "success",
        message: "Contact created successfully",
        data: responseData,
      });
    } else {
      // Update contact
      contactData = await Contact.findOneAndUpdate(
        { _id: contact_id, createdBy: req.user._id },
        {
          firstname,
          lastname,
          emailaddresses,
          phonenumbers,
          contactImageURL: contactImage || undefined, // update only if a new image uploaded
          isFavourite,
          tags: matchedTags,
          notes,
          website,
        },
        { new: true }
      );

      if (!contactData) {
        return res.status(404).json({
          status: "error",
          message: "Contact not found or unauthorized access",
        });
      }

      const responseData = contactData.toObject();
      const tag = responseData.tags.map(tag => tag.tag);
      responseData.tags = tag;
      delete responseData.createdBy;
      delete responseData._id;
      delete responseData.createdAt;
      delete responseData.updatedAt;
      delete responseData.__v;

      return res.status(200).json({
        status: "success",
        message: "Contact updated successfully",
        data: responseData,
      });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: "error", message: "An error occurred" });
  }
};

module.exports = { addEditContact };
