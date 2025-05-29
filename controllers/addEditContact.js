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

// const addEditContact = async (req, res) => {
//   try {
//     const user = await User.findById(req.user._id);
//     if (!user) {
//       return res.status(401).json({ status: "error", message: "Unauthorized: User not found" });
//     }

//     const {
//       contact_id,
//       firstname,
//       lastname,
//       emailaddresses,
//       phonenumbers,
//       isFavourite,
//       notes,
//       website,
//       task_id,
//       taskTitle,
//       taskDescription,
//       taskDueDate,
//       taskDueTime,
//       taskIsCompleted,
//     } = req.body;

//     let matchedTags = [];
//     if (req.body.tags) {
//       try {
//         const tagsArray = JSON.parse(req.body.tags);
//         matchedTags = user.tags
//           .filter((tagObj) => tagsArray.includes(tagObj.tag))
//           .map((tagObj) => ({
//             tag_id: tagObj.tag_id,
//             tag: tagObj.tag,
//           }));
//       } catch (err) {
//         return res.status(400).json({
//           status: "error",
//           message: "Tags must be a valid JSON array of strings.",
//         });
//       }
//     }

//     const uploadImageToS3 = async (file) => {
//       const ext = path.extname(file.originalname);
//       const name = path.basename(file.originalname, ext);
//       const fileName = `contactImages/${name}_${Date.now()}${ext}`;
//       const params = {
//         Bucket: process.env.AWS_BUCKET_NAME,
//         Key: fileName,
//         Body: file.buffer,
//         ContentType: file.mimetype,
//       };
//       try {
//         await s3.send(new PutObjectCommand(params));
//         return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
//       } catch (error) {
//         console.error("S3 upload failed:", error);
//         throw new Error("Image upload failed");
//       }
//     };

//     let contactImage = "";
//     if (req.file) {
//       contactImage = await uploadImageToS3(req.file);
//     }

//     const isCreating = !contact_id || contact_id === "0";
//     const taskProvided = taskTitle || taskDescription || taskDueDate || taskDueTime || taskIsCompleted;

//     if (isCreating && taskProvided && (taskIsCompleted === true || taskIsCompleted === "true")) {
//       return res.status(400).json({
//         status: "error",
//         message: "Task complete status cannot be set when creating a contact.",
//       });
//     }

//     let taskObj = null;
//     if (taskProvided) {
//       taskObj = {};
//       if (task_id) {
//         taskObj.task_id = new mongoose.Types.ObjectId(task_id);
//       } else {
//         taskObj.task_id = new mongoose.Types.ObjectId();
//         taskObj.createdAt = new Date(); // Set createdAt only on new task
//       }

//       if (taskTitle) taskObj.taskTitle = taskTitle;
//       if (taskDescription) taskObj.taskDescription = taskDescription;
//       if (taskDueDate) taskObj.taskDueDate = taskDueDate;
//       if (taskDueTime) taskObj.taskDueTime = taskDueTime;

//       if (isCreating) {
//         taskObj.taskIsCompleted = false;
//       } else if (typeof taskIsCompleted !== "undefined") {
//         taskObj.taskIsCompleted = taskIsCompleted === true || taskIsCompleted === "true";
//       }

//       if (!isCreating && task_id) {
//         taskObj.updatedAt = new Date(); // Set updatedAt only when editing an existing task
//       }
//     }

//     let contactData;
//     if (isCreating) {
//       if (taskProvided && task_id) {
//         return res.status(400).json({
//           status: "error",
//           message: "Task ID should not be provided when creating a contact with a task.",
//         });
//       }

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
//       if (taskObj) contactPayload.tasks = [taskObj];

//       contactData = await Contact.create(contactPayload);
//       contactData.contact_id = contactData._id;
//       await contactData.save();
//     } else {
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

//       if (taskObj) {
//         const taskIndex = contactData.tasks.findIndex(
//           (task) => task?.task_id?.toString() === taskObj.task_id.toString()
//         );

//         if (taskIndex >= 0) {
//           Object.assign(contactData.tasks[taskIndex], {
//             ...taskObj,
//             taskIsCompleted:
//               taskObj.taskIsCompleted !== undefined
//                 ? taskObj.taskIsCompleted
//                 : contactData.tasks[taskIndex].taskIsCompleted,
//           });
//           contactData.markModified("tasks");
//         } else {
//           taskObj.createdAt = new Date();
//           contactData.tasks.unshift({
//             ...taskObj,
//             taskIsCompleted: taskObj.taskIsCompleted ?? false,
//           });
//         }

//         contactData.updatedAt = new Date(); // ✅ Force Contact's updatedAt update
//         await contactData.save();
//       }

//     }

//     const responseData = contactData.toObject();
//     responseData.contact_id = responseData._id;
//     responseData.tags = responseData.tags?.map((tag) => tag.tag) || [];
//     if (responseData.tasks?.length) {
//       responseData.tasks = responseData.tasks.map((t) => ({
//         task_id: t.task_id,
//         taskTitle: t.taskTitle,
//         taskDescription: t.taskDescription,
//         taskDueDate: t.taskDueDate,
//         taskDueTime: t.taskDueTime,
//         taskIsCompleted: !!t.taskIsCompleted,
//         createdAt: t.createdAt,
//         updatedAt: t.updatedAt
//       }));
//     }

//     delete responseData.createdBy;
//     delete responseData._id;
//     delete responseData.createdAt;
//     delete responseData.updatedAt;
//     delete responseData.__v;

//     return res.status(isCreating ? 201 : 200).json({
//       status: "success",
//       message: isCreating ? "Contact created successfully" : "Contact updated successfully",
//       data: responseData,
//     });
//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({ status: "error", message: "An error occurred" });
//   }
// };


// updated function 
// const addEditContact = async (req, res) => {
//   try {
//     const user = await User.findById(req.user._id);
//     if (!user) {
//       return res.status(401).json({ status: "error", message: "Unauthorized: User not found" });
//     }

//     const {
//       contact_id,
//       firstname,
//       lastname,
//       emailaddresses,
//       phonenumbers,
//       isFavourite,
//       notes,
//       website,
//       task_id,
//       taskTitle,
//       taskDescription,
//       taskDueDate,
//       taskDueTime,
//       taskIsCompleted,
//     } = req.body;

//     // ---------- Handle Tags ----------
//     let matchedTags = [];
//     let tagsProvided = false;
//     if (req.body.tags) {
//       try {
//         tagsProvided = true;
//         const tagsArray = JSON.parse(req.body.tags);
//         matchedTags = user.tags
//           .filter((tagObj) => tagsArray.includes(tagObj.tag))
//           .map((tagObj) => ({
//             tag_id: tagObj.tag_id,
//             tag: tagObj.tag,
//           }));
//       } catch (err) {
//         return res.status(400).json({
//           status: "error",
//           message: "Tags must be a valid JSON array of strings.",
//         });
//       }
//     }

//     // ---------- Upload Image ----------
//     const uploadImageToS3 = async (file) => {
//       const ext = path.extname(file.originalname);
//       const name = path.basename(file.originalname, ext);
//       const fileName = `contactImages/${name}_${Date.now()}${ext}`;
//       const params = {
//         Bucket: process.env.AWS_BUCKET_NAME,
//         Key: fileName,
//         Body: file.buffer,
//         ContentType: file.mimetype,
//       };
//       try {
//         await s3.send(new PutObjectCommand(params));
//         return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
//       } catch (error) {
//         console.error("S3 upload failed:", error);
//         throw new Error("Image upload failed");
//       }
//     };

//     let contactImage = "";
//     if (req.file) {
//       contactImage = await uploadImageToS3(req.file);
//     }

//     const isCreating = !contact_id || contact_id === "0";

//     // ---------- Handle Tasks ----------
//     const taskProvided = taskTitle || taskDescription || taskDueDate || taskDueTime || typeof taskIsCompleted !== "undefined";
//     if (isCreating && taskProvided && (taskIsCompleted === true || taskIsCompleted === "true")) {
//       return res.status(400).json({
//         status: "error",
//         message: "Task complete status cannot be set when creating a contact.",
//       });
//     }

//     let taskObj = null;
//     if (taskProvided) {
//       taskObj = {};
//       if (task_id) {
//         taskObj.task_id = new mongoose.Types.ObjectId(task_id);
//       } else {
//         taskObj.task_id = new mongoose.Types.ObjectId();
//         taskObj.createdAt = new Date();
//       }

//       if (taskTitle) taskObj.taskTitle = taskTitle;
//       if (taskDescription) taskObj.taskDescription = taskDescription;
//       if (taskDueDate) taskObj.taskDueDate = taskDueDate;
//       if (taskDueTime) taskObj.taskDueTime = taskDueTime;

//       if (isCreating) {
//         taskObj.taskIsCompleted = false;
//       } else if (typeof taskIsCompleted !== "undefined") {
//         taskObj.taskIsCompleted = taskIsCompleted === true || taskIsCompleted === "true";
//       }

//       if (!isCreating && task_id) {
//         taskObj.updatedAt = new Date();
//       }
//     }

//     let contactData;
//     if (isCreating) {
//       if (taskProvided && task_id) {
//         return res.status(400).json({
//           status: "error",
//           message: "Task ID should not be provided when creating a contact with a task.",
//         });
//       }

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
//       if (taskObj) contactPayload.tasks = [taskObj];

//       contactData = await Contact.create(contactPayload);
//       contactData.contact_id = contactData._id;
//       await contactData.save();
//     } else {
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
//       if (tagsProvided) updateFields.tags = matchedTags;

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

//       if (taskObj) {
//         const taskIndex = contactData.tasks.findIndex(
//           (task) => task?.task_id?.toString() === taskObj.task_id.toString()
//         );

//         if (taskIndex >= 0) {
//           Object.assign(contactData.tasks[taskIndex], {
//             ...taskObj,
//             taskIsCompleted:
//               taskObj.taskIsCompleted !== undefined
//                 ? taskObj.taskIsCompleted
//                 : contactData.tasks[taskIndex].taskIsCompleted,
//           });
//           contactData.markModified("tasks");
//         } else {
//           taskObj.createdAt = new Date();
//           contactData.tasks.unshift({
//             ...taskObj,
//             taskIsCompleted: taskObj.taskIsCompleted ?? false,
//           });
//         }

//         contactData.updatedAt = new Date();
//         await contactData.save();
//       }
//     }

//     // ---------- Format Response ----------
//     const responseData = contactData.toObject();
//     responseData.contact_id = responseData._id;
//     responseData.tags = responseData.tags?.map((tag) => tag.tag) || [];
//     if (responseData.tasks?.length) {
//       responseData.tasks = responseData.tasks.map((t) => ({
//         task_id: t.task_id,
//         taskTitle: t.taskTitle,
//         taskDescription: t.taskDescription,
//         taskDueDate: t.taskDueDate,
//         taskDueTime: t.taskDueTime,
//         taskIsCompleted: !!t.taskIsCompleted,
//         createdAt: t.createdAt,
//         updatedAt: t.updatedAt
//       }));
//     }

//     delete responseData.createdBy;
//     delete responseData._id;
//     delete responseData.createdAt;
//     delete responseData.updatedAt;
//     delete responseData.__v;

//     // ---------- Choose Message ----------
//     let message = "";
//     if (taskProvided) {
//       message = "Task created/updated successfully";
//     } else if (tagsProvided) {
//       message = "Tag(s) created/updated successfully";
//     } else {
//       message = isCreating ? "Contact created successfully" : "Contact updated successfully";
//     }

//     return res.status(isCreating ? 201 : 200).json({
//       status: "success",
//       message,
//       data: responseData,
//     });

//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({ status: "error", message: "An error occurred" });
//   }
// };

//new function

const addEditContact = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(401).json({ status: "error", message: "Unauthorized: User not found" });
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
      meeting_id,
      meetingTitle,
      meetingDescription,
      meetingStartDate,
      meetingStartTime,
      meetingEndDate,
      meetingEndTime,
      meetingType,
      meetingLocation,
      meetingLink
    } = req.body;

    // ---------- Handle Tags ----------
    let matchedTags = [];
    let tagsProvided = false;
    if (req.body.tags) {
      try {
        tagsProvided = true;
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

    // ---------- Upload Image ----------
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

    const isCreating = !contact_id || contact_id === "0";

    // ---------- Handle Task ----------
    const taskProvided = taskTitle || taskDescription || taskDueDate || taskDueTime || typeof taskIsCompleted !== "undefined";
    if (isCreating && taskProvided && (taskIsCompleted === true || taskIsCompleted === "true")) {
      return res.status(400).json({
        status: "error",
        message: "Task complete status cannot be set when creating a contact.",
      });
    }

    let taskObj = null;
    if (taskProvided) {
      taskObj = {};
      if (task_id) {
        taskObj.task_id = new mongoose.Types.ObjectId(task_id);
      } else {
        taskObj.task_id = new mongoose.Types.ObjectId();
        taskObj.createdAt = new Date();
      }

      if (taskTitle) taskObj.taskTitle = taskTitle;
      if (taskDescription) taskObj.taskDescription = taskDescription;
      if (taskDueDate) taskObj.taskDueDate = taskDueDate;
      if (taskDueTime) taskObj.taskDueTime = taskDueTime;

      if (isCreating) {
        taskObj.taskIsCompleted = false;
      } else if (typeof taskIsCompleted !== "undefined") {
        taskObj.taskIsCompleted = taskIsCompleted === true || taskIsCompleted === "true";
      }

      if (!isCreating && task_id) {
        taskObj.updatedAt = new Date();
      }
    }

    // ---------- Handle Meeting ----------
    const meetingProvided = meetingTitle || meetingDescription || meetingStartDate || meetingStartTime || meetingType || meetingEndDate || meetingEndTime;
    let meetingObj = null;
    if (meetingProvided) {
      meetingObj = {};
      if (meeting_id) {
        meetingObj.meeting_id = new mongoose.Types.ObjectId(meeting_id);
      } else {
        meetingObj.meeting_id = new mongoose.Types.ObjectId();
        meetingObj.createdAt = new Date();
      }

      if (meetingTitle) meetingObj.meetingTitle = meetingTitle;
      if (meetingDescription) meetingObj.meetingDescription = meetingDescription;
      if (meetingStartDate) meetingObj.meetingStartDate = meetingStartDate;
      if (meetingStartTime) meetingObj.meetingStartTime = meetingStartTime;
      if (meetingEndTime) meetingObj.meetingEndTime = meetingEndTime;
      if (meetingEndDate) meetingObj.meetingEndDate = meetingEndDate;

      if (meetingType) meetingObj.meetingType = meetingType;
      if (meetingType === "online" && meetingLink) meetingObj.meetingLink = meetingLink;
      if (meetingType === "offline" && meetingLocation) meetingObj.meetingLocation = meetingLocation;

      if (!isCreating && meeting_id) {
        meetingObj.updatedAt = new Date();
      }
    }

    let contactData;
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
      if (meetingObj) contactPayload.meetings = [meetingObj];

      contactData = await Contact.create(contactPayload);
      contactData.contact_id = contactData._id;
      await contactData.save();
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
      if (tagsProvided) updateFields.tags = matchedTags;

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

      // ----- Update or Add Task -----
      if (taskObj) {
        const taskIndex = contactData.tasks.findIndex((task) => task?.task_id?.toString() === taskObj.task_id.toString());

        if (taskIndex >= 0) {
          Object.assign(contactData.tasks[taskIndex], {
            ...taskObj,
            taskIsCompleted: taskObj.taskIsCompleted !== undefined
              ? taskObj.taskIsCompleted
              : contactData.tasks[taskIndex].taskIsCompleted,
          });
          contactData.markModified("tasks");
        } else {
          taskObj.createdAt = new Date();
          contactData.tasks.unshift({
            ...taskObj,
            taskIsCompleted: taskObj.taskIsCompleted ?? false,
          });
        }

        contactData.updatedAt = new Date();
      }

      // ----- Update or Add Meeting -----
      if (meetingObj) {
        const meetingIndex = contactData.meetings?.findIndex((meeting) => meeting?.meeting_id?.toString() === meetingObj.meeting_id.toString()) ?? -1;

        if (meetingIndex >= 0) {
          Object.assign(contactData.meetings[meetingIndex], meetingObj);
          contactData.markModified("meetings");
        } else {
          meetingObj.createdAt = new Date();
          if (!contactData.meetings) contactData.meetings = [];
          contactData.meetings.unshift(meetingObj);
        }

        contactData.updatedAt = new Date();
      }

      await contactData.save();
    }

    // ---------- Format Response ----------
    const responseData = contactData.toObject();
    responseData.contact_id = responseData._id;
    responseData.tags = responseData.tags?.map((tag) => tag.tag) || [];

    if (responseData.tasks?.length) {
      responseData.tasks = responseData.tasks.map((t) => ({
        task_id: t.task_id,
        taskTitle: t.taskTitle,
        taskDescription: t.taskDescription,
        taskDueDate: t.taskDueDate,
        taskDueTime: t.taskDueTime,
        taskIsCompleted: !!t.taskIsCompleted,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      }));
    }

    if (responseData.meetings?.length) {
      responseData.meetings = responseData.meetings.map((m) => ({
        meeting_id: m.meeting_id,
        meetingTitle: m.meetingTitle,
        meetingDescription: m.meetingDescription,
        meetingStartDate: m.meetingStartDate,
        meetingStartTime: m.meetingStartTime,
        meetingEndDate: m.meetingEndDate,
        meetingEndTime: m.meetingEndTime,
        meetingType: m.meetingType,
        meetingLocation: m.meetingLocation,
        meetingLink: m.meetingLink,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      }));
    }

    delete responseData.createdBy;
    delete responseData._id;
    delete responseData.createdAt;
    delete responseData.updatedAt;
    delete responseData.__v;

    // ---------- Choose Message ----------
    let message = "";
    // if (taskProvided && meetingProvided) {
    //   message = "Task and meeting created successfully";
    // } 
    if (meeting_id) {
      message = "Meeting updated successfully";
    } else if (meetingProvided) {
      message = "Meeting created successfully";
    } else if (task_id) {
      message = "Task updated successfully";
    } else if (taskProvided) {
      message = "Task created successfully";
    } else if (tagsProvided) {
      message = "Tags created/updated successfully";
    } else {
      message = isCreating ? "Contact created successfully" : "Contact updated successfully";
    }

    return res.status(isCreating ? 201 : 200).json({
      status: "success",
      message,
      data: responseData,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: "error", message: "An error occurred" });
  }
};



module.exports = { addEditContact };
