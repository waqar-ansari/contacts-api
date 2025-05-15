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
    contactImage,
    isFavourite,
    tags,
    notes,
    website,
  } = req.body;

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
    console.log("contact image url");
    const ext = path.extname(file.originalname); // e.g., ".jpg"
    const name = path.basename(file.originalname, ext); // e.g., "yash"
    const fileName = `contactImages/${name}_${Date.now()}${ext}`;
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

    console.log("contact image url5");
    console.log(
      "Image uploaded to S3 successfully",
      `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`
    );

    return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
  };
  try {
    let contactImage = "";
    if (req.file) {
      contactImage = await uploadImageToS3(req.file);
    }
    let data;
    if (!contact_id || contact_id === "0") {
      data = await Contact.create({
        firstname,
        lastname,
        emailaddresses,
        phonenumbers,
        contactImageURL: contactImage,
        isFavourite,
        tags,
        notes,
        website,
        createdBy: req.user._id,
      });
      data.contact_id = data._id;
      await data.save();

      // const responseData = data.toObject();
      const responseData = {
        contact_id: data._id,
        firstname: data.firstname,
        lastname: data.lastname,
        emailaddresses: data.emailaddresses,
        contactImageURL: data.contactImageURL,
        isFavourite: data.isFavourite,
        tags: Array.isArray(data.tags) ? data.tags : [],
        notes: data.notes,
        website: data.website,
        phonenumbers: Array.isArray(data.phonenumbers)
          ? data.phonenumbers.map((item) => ({
              countryCode: item.countryCode || "",
              phoneNumber: item.phoneNumber || "",
            }))
          : [],
      };
      
      delete responseData._id;
      delete responseData.createdAt;
      delete responseData.updatedAt;
      delete responseData.__v;

      res.status(201).json({
        status: "success",
        message: "Contact created successfully",
        data: responseData,
      });
    } else {
      console.log(contactImage, "contact image url to be updated in db");
      data = await Contact.findOneAndUpdate(
        { _id: contact_id, createdBy: req.user._id },
        {
          firstname,
          lastname,
          emailaddresses,
          phonenumbers,
          contactImageURL: contactImage,
          isFavourite,
          tags,
          notes,
          website,
        },
        { new: true }
      ).populate("createdBy");
      console.log(data, "data after update");

      if (!data) {
        return res.status(404).json({
          status: "error",
          message: "Contact not found or unauthorized access",
        });
      }

      // const responseData = data.toObject();
      const responseData = {
        contact_id: data._id,
        firstname: data.firstname,
        lastname: data.lastname,
        emailaddresses: data.emailaddresses,
        contactImageURL: data.contactImageURL,
        isFavourite: data.isFavourite,
        tags: Array.isArray(data.tags) ? data.tags : [],
        notes: data.notes,
        website: data.website,
        phonenumbers: Array.isArray(data.phonenumbers)
          ? data.phonenumbers.map((item) => ({
              countryCode: item.countryCode || "",
              phoneNumber: item.phoneNumber || "",
            }))
          : [],
      };
      delete responseData.createdBy; // Remove createdBy from response
      delete responseData._id;
      delete responseData.createdAt;
      delete responseData.updatedAt;
      delete responseData.__v;

      res.status(200).json({
        status: "success",
        message: "Contact updated successfully",
        data: responseData,
      });
    }
  } catch (error) {
    console.log(error);

    res.status(500).json({ status: "error", message: "An error occurred" });
  }
};

module.exports = { addEditContact };
