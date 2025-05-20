// // const { mongoose } = require("mongoose");
// // const Contact = require("../models/contactModel");

// // const addEditContact = async (req, res) => {
// //   const {
// //     contact_id,
// //     firstname,
// //     lastname,
// //     emailaddresses,
// //     phonenumbers,
// //     contactImageURL,
// //     isFavourite,
// //     tags,
// //   } = req.body;

// //   try {
// //     let data;
// //     if (contact_id === "0") {
// //       data = await Contact.create({
// //         firstname,
// //         lastname,
// //         emailaddresses,
// //         phonenumbers,
// //         contactImageURL,
// //         isFavourite,
// //         tags,
// //         createdBy: req.user._id,
// //       });
// //       data.contact_id = data._id;
// //       await data.save();

// //       res.status(201).json({
// //         status: "success",
// //         message: "Contact created successfully",
// //       });
// //     } else {

// //       data = await Contact.findOneAndUpdate(
// //         { _id: contact_id, createdBy: req.user._id },
// //         {
// //           firstname,
// //           lastname,
// //           emailaddresses,
// //           phonenumbers,
// //           contactImageURL,
// //           isFavourite,
// //           tags,
// //         },
// //         { new: true }
// //       ).populate("createdBy");

// //       if (!data) {
// //         return res
// //           .status(404)
// //           .json({
// //             status: "error",
// //             message: "Contact not found or unauthorized access",
// //           });
// //       }

// //       res.status(200).json({
// //         status: "success",
// //         message: "Contact updated successfully",
// //       });
// //     }
// //   } catch (error) {
// //     res.status(500).json({ status: "error", message: "An error occurred" });
// //   }
// // };

// // module.exports = { addEditContact };

// const { mongoose } = require("mongoose");
// const Contact = require("../models/contactModel");
// const User = require("../models/userModel");
// const s3 = require("../utils/s3");
// const { PutObjectCommand } = require("@aws-sdk/client-s3");
// const path = require("path");

// const addEditContact = async (req, res) => {
//   const {
//     contact_id,
//     firstname,
//     lastname,
//     emailaddresses,
//     phonenumbers,
//     isFavourite,
//     notes,
//     website,
//   } = req.body;

//   let matchedTags = [];

//   // Only parse tags if provided
//   if (req.body.tags) {
//     let tagsArray = [];
//     try {
//       tagsArray = JSON.parse(req.body.tags);
//       const user = await User.findById(req.user._id);
//       if (!user) {
//         return res.status(401).json({ status: "error", message: "User not found" });
//       }
//       matchedTags = user.tags
//         .filter((tagObj) => tagsArray.includes(tagObj.tag))
//         .map((tagObj) => ({
//           tag_id: tagObj.tag_id,
//           tag: tagObj.tag,
//         }));
//     } catch (err) {
//       return res.status(400).json({
//         status: "error",
//         message: "Tags must be a valid JSON array of strings.",
//       });
//     }
//   }


//   const uploadImageToS3 = async (file) => {
//     const ext = path.extname(file.originalname);
//     const name = path.basename(file.originalname, ext);
//     const fileName = `contactImages/${name}_${Date.now()}${ext}`;
//     const params = {
//       Bucket: process.env.AWS_BUCKET_NAME,
//       Key: fileName,
//       Body: file.buffer,
//       ContentType: file.mimetype,
//     };

//     try {
//       await s3.send(new PutObjectCommand(params));
//       return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
//     } catch (error) {
//       console.error("S3 upload failed:", error);
//       throw new Error("Image upload failed");
//     }
//   };

//   try {
//     let contactImage = "";
//     if (req.file) {
//       contactImage = await uploadImageToS3(req.file);
//     }

//     let contactData;
//     if (!contact_id || contact_id === "0") {
//       // Create
//       const contactPayload = {
//         firstname,
//         lastname,
//         emailaddresses,
//         phonenumbers,
//         contactImageURL: contactImage,
//         isFavourite,
//         notes,
//         website,
//         createdBy: req.user._id,
//       };

//       if (matchedTags.length > 0) contactPayload.tags = matchedTags;

//       contactData = await Contact.create(contactPayload);
//       contactData.contact_id = contactData._id;
//       await contactData.save();

//       const responseData = contactData.toObject();
//       responseData.tags = responseData.tags?.map((tag) => tag.tag) || [];
//       delete responseData.createdBy;
//       delete responseData._id;
//       delete responseData.createdAt;
//       delete responseData.updatedAt;
//       delete responseData.__v;

//       return res.status(201).json({
//         status: "success",
//         message: "Contact created successfully",
//         data: responseData,
//       });
//     } else {
//       // Update
//       const updateFields = {
//         firstname,
//         lastname,
//         emailaddresses,
//         phonenumbers,
//         isFavourite,
//         notes,
//         website,
//       };

//       if (contactImage) updateFields.contactImageURL = contactImage;
//       if (req.body.tags) updateFields.tags = matchedTags;

//       contactData = await Contact.findOneAndUpdate(
//         { _id: contact_id, createdBy: req.user._id },
//         updateFields,
//         { new: true }
//       );

//       if (!contactData) {
//         return res.status(404).json({
//           status: "error",
//           message: "Contact not found or unauthorized access",
//         });
//       }

//       const responseData = contactData.toObject();
//       responseData.tags = responseData.tags?.map((tag) => tag.tag) || [];
//       delete responseData.createdBy;
//       delete responseData._id;
//       delete responseData.createdAt;
//       delete responseData.updatedAt;
//       delete responseData.__v;

//       return res.status(200).json({
//         status: "success",
//         message: "Contact updated successfully",
//         data: responseData,
//       });
//     }
//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({ status: "error", message: "An error occurred" });
//   }
// };

// module.exports = { addEditContact };

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

const mongoose = require("mongoose");
const Contact = require("../models/contactModel");
const User = require("../models/userModel");
const s3 = require("../utils/s3");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const path = require("path");

const addEditContact = async (req, res) => {
  try {
    // ✅ 1. Check if the user exists in the database
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized: User not found",
      });
    }

    const {
      contact_id,
      firstname,
      lastname,
      emailaddresses,
      phonenumbers,
      isFavourite,
      notes,
      website,
      task_id,
      taskTitle,
      taskDescription,
      taskDueDate,
      taskDueTime,
      taskIsCompleted,
    } = req.body;

    let matchedTags = [];

    if (req.body.tags) {
      try {
        const tagsArray = JSON.parse(req.body.tags);
        matchedTags = user.tags
          .filter((tagObj) => tagsArray.includes(tagObj.tag))
          .map((tagObj) => ({
            tag_id: tagObj.tag_id,
            tag: tagObj.tag,
          }));
      } catch (err) {
        return res.status(400).json({
          status: "error",
          message: "Tags must be a valid JSON array of strings.",
        });
      }
    }

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

    let contactImage = "";
    if (req.file) {
      contactImage = await uploadImageToS3(req.file);
    }

    let contactData;
    const taskProvided = taskTitle || taskDescription || taskDueDate || taskDueTime;
    const isCreating = !contact_id || contact_id === "0";

    if (isCreating && taskProvided && (taskIsCompleted === true || taskIsCompleted === "true")) {
      return res.status(400).json({
        status: "error",
        message: "Task complete status cannot be set when creating a contact.",
      });
    }

    let taskObj = null;
    if (taskProvided) {
      taskObj = {
        task_id: task_id ? new mongoose.Types.ObjectId(task_id) : new mongoose.Types.ObjectId(),
        taskTitle,
        taskDescription,
        taskDueDate,
        taskDueTime,
      };

      if (isCreating) {
        taskObj.taskIsCompleted = false;
      } else if (typeof taskIsCompleted !== "undefined") {
        taskObj.taskIsCompleted = taskIsCompleted === true || taskIsCompleted === "true";
      }
    }

    if (isCreating) {
      if (taskProvided && task_id) {
        return res.status(400).json({
          status: "error",
          message: "Task ID should not be provided when creating a contact with a task.",
        });
      }

      const contactPayload = {
        firstname,
        lastname,
        emailaddresses,
        phonenumbers,
        contactImageURL: contactImage,
        isFavourite,
        notes,
        website,
        createdBy: req.user._id,
      };

      if (matchedTags.length > 0) contactPayload.tags = matchedTags;
      if (taskObj) contactPayload.tasks = [taskObj];

      contactData = await Contact.create(contactPayload);
      contactData.contact_id = contactData._id;
      await contactData.save();

      const responseData = contactData.toObject();
      responseData.tags = responseData.tags?.map((tag) => tag.tag) || [];

      if (responseData.tasks?.length) {
        responseData.tasks = responseData.tasks.map((t) => ({
          ...t,
          taskIsCompleted: !!t.taskIsCompleted,
        }));
      }

      delete responseData.createdBy;
      delete responseData._id;
      delete responseData.createdAt;
      // delete responseData.updatedAt;
      delete responseData.__v;

      return res.status(201).json({
        status: "success",
        message: "Contact created successfully",
        data: responseData,
      });
    } else {
      const updateFields = {
        firstname,
        lastname,
        emailaddresses,
        phonenumbers,
        isFavourite,
        notes,
        website,
      };

      if (contactImage) updateFields.contactImageURL = contactImage;
      if (req.body.tags) updateFields.tags = matchedTags;

      contactData = await Contact.findOneAndUpdate(
        { _id: contact_id, createdBy: req.user._id },
        updateFields,
        { new: true }
      );

      if (!contactData) {
        return res.status(404).json({
          status: "error",
          message: "Contact not found or unauthorized access",
        });
      }

      if (taskObj) {
        const taskIndex = contactData.tasks.findIndex(
          (task) => task?.task_id?.toString() === taskObj.task_id.toString()
        );

        if (taskIndex >= 0) {
          const existingTask = contactData.tasks[taskIndex];
          contactData.tasks[taskIndex] = {
            ...existingTask,
            ...taskObj,
            taskIsCompleted:
              taskObj.taskIsCompleted !== undefined
                ? taskObj.taskIsCompleted
                : existingTask.taskIsCompleted,
          };
        } else {
          contactData.tasks.push({
            ...taskObj,
            taskIsCompleted: taskObj.taskIsCompleted ?? false,
          });
        }

        await contactData.save();
      }

      const responseData = contactData.toObject();
      responseData.tags = responseData.tags?.map((tag) => tag.tag) || [];

      if (responseData.tasks?.length) {
        responseData.tasks = responseData.tasks.map((t) => ({
          ...t,
          taskIsCompleted: !!t.taskIsCompleted,
        }));
      }

      delete responseData.createdBy;
      delete responseData._id;
      delete responseData.createdAt;
      // delete responseData.updatedAt;
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
