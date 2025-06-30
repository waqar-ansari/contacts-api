const mongoose = require("mongoose");
const Contact = require("../models/contactModel");
const User = require("../models/userModel");
const s3 = require("../utils/s3");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const path = require("path");
const { createGoogleMeetEvent } = require("../utils/googleCalendar");


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
      company,
      designation,
      linkedin,
      instagram,
      telegram,
      twitter,
      facebook,
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

    // ---------- Normalize Phone Numbers ----------
    let parsedPhones = [];

    if (phonenumbers) {
      try {
        // Case 1: Valid JSON array string like '["1234","5678"]' or plain number: 1111111
        const temp = JSON.parse(phonenumbers);
        console.log("Parsed phone numbers:", temp);

        const phoneArray = Array.isArray(temp) ? temp : [temp];
        console.log("Phone array:", phoneArray);

        parsedPhones = phoneArray
          .filter(num => num !== null && num !== undefined && num !== "undefined")
          .map(num => String(num).replace(/[^\d]/g, ""));

        console.log("Normalized phone numbers:", parsedPhones);

      } catch (e) {
        // Case 2: Plain string like "1111111"
        if (typeof phonenumbers === "string" && phonenumbers.trim() !== "" && phonenumbers !== "undefined") {
          parsedPhones = [phonenumbers.replace(/[^\d]/g, "")];
        }
      }
    }

    console.log("Parsed Phones:", phonenumbers, parsedPhones);

    // // ---------- ✅ Handle Tags ----------
    // let matchedTags = [];
    // let tagsProvided = false;
    // if (req.body.tags) {
    //   try {
    //     tagsProvided = true;
    //     const tagsArray = JSON.parse(req.body.tags);

    //     matchedTags = user.tags
    //       .filter((tagObj) => tagsArray.includes(tagObj.tag))
    //       .map((tagObj) => ({
    //         tag_id: tagObj.tag_id,
    //         tag: tagObj.tag,
    //         icon: tagObj.icon || null, // include icon if present
    //       }));
    //   } catch (err) {
    //     return res.status(400).json({
    //       status: "error",
    //       message: "Tags must be a valid JSON array of strings.",
    //     });
    //   }
    // }

    // ---------- ✅ Handle Tags ----------
    let matchedTags = [];
    let tagsProvided = false;

    if (req.body.tags) {
      try {
        tagsProvided = true;

        const tagsArray = JSON.parse(req.body.tags); // should be array of objects like [{ tag: "Marketing", emoji: "https://..." }]

        if (!Array.isArray(tagsArray)) {
          return res.status(400).json({
            status: "error",
            message: "Tags must be a valid JSON array of objects with 'tag' and optional 'emoji'",
          });
        }

        matchedTags = [];

        for (const tagItem of tagsArray) {
          const tagText = tagItem.tag?.trim();
          const emoji = tagItem.emoji || "";

          if (!tagText) continue;

          const existingUserTag = user.tags.find(
            (t) => t.tag.toLowerCase() === tagText.toLowerCase()
          );

          let tagObj;

          if (existingUserTag) {
            // Use existing tag
            tagObj = {
              tag_id: existingUserTag.tag_id,
              tag: existingUserTag.tag,
              emoji: existingUserTag.emoji || null,
            };
          } else {
            // Create new tag in user model
            const newTag = {
              tag_id: new mongoose.Types.ObjectId(),
              tag: tagText,
              emoji,
            };
            user.tags.push(newTag);
            await user.save();

            tagObj = {
              tag_id: newTag.tag_id,
              tag: newTag.tag,
              emoji: newTag.emoji || null,
            };
          }

          matchedTags.push(tagObj);
        }
      } catch (err) {
        return res.status(400).json({
          status: "error",
          message: "Tags must be a valid JSON array of objects with tag/emoji",
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
    // const meetingProvided = meetingTitle || meetingDescription || meetingStartDate || meetingStartTime || meetingType || meetingEndDate || meetingEndTime;
    // let meetingObj = null;
    // if (meetingProvided) {
    //   meetingObj = {};
    //   if (meeting_id) {
    //     meetingObj.meeting_id = new mongoose.Types.ObjectId(meeting_id);
    //   } else {
    //     meetingObj.meeting_id = new mongoose.Types.ObjectId();
    //     meetingObj.createdAt = new Date();
    //   }

    //   if (meetingTitle) meetingObj.meetingTitle = meetingTitle;
    //   if (meetingDescription) meetingObj.meetingDescription = meetingDescription;
    //   if (meetingStartDate) meetingObj.meetingStartDate = meetingStartDate;
    //   if (meetingStartTime) meetingObj.meetingStartTime = meetingStartTime;
    //   if (meetingEndTime) meetingObj.meetingEndTime = meetingEndTime;
    //   if (meetingEndDate) meetingObj.meetingEndDate = meetingEndDate;

    //   if (meetingType) meetingObj.meetingType = meetingType;
    //   if (meetingType === "online" && meetingLink) meetingObj.meetingLink = meetingLink;
    //   if (meetingType === "offline" && meetingLocation) meetingObj.meetingLocation = meetingLocation;

    //   if (!isCreating && meeting_id) {
    //     meetingObj.updatedAt = new Date();
    //   }
    // }

    // ---------- Handle Meeting ----------
    // const meetingProvided = meetingTitle || meetingDescription || meetingStartDate || meetingStartTime || meetingType || meetingEndDate || meetingEndTime;
    // let meetingObj = null;
    // if (meetingProvided) {
    //   // ✅ For online meeting: Check Google connection
    //   if (meetingType === "online") {
    //     if (!user.googleAccessToken || !user.googleRefreshToken) {
    //       return res.status(400).json({
    //         status: "error",
    //         message: "To create an online meeting, please first connect your Google account.",
    //       });
    //     }
    //   }

    //   meetingObj = {};
    //   if (meeting_id) {
    //     meetingObj.meeting_id = new mongoose.Types.ObjectId(meeting_id);
    //   } else {
    //     meetingObj.meeting_id = new mongoose.Types.ObjectId();
    //     meetingObj.createdAt = new Date();
    //   }

    //   if (meetingTitle) meetingObj.meetingTitle = meetingTitle;
    //   if (meetingDescription) meetingObj.meetingDescription = meetingDescription;
    //   if (meetingStartDate) meetingObj.meetingStartDate = meetingStartDate;
    //   if (meetingStartTime) meetingObj.meetingStartTime = meetingStartTime;
    //   if (meetingEndTime) meetingObj.meetingEndTime = meetingEndTime;
    //   if (meetingEndDate) meetingObj.meetingEndDate = meetingEndDate;

    //   if (meetingType) meetingObj.meetingType = meetingType;
    //   if (meetingType === "online" && meetingLink) meetingObj.meetingLink = meetingLink;
    //   if (meetingType === "offline" && meetingLocation) meetingObj.meetingLocation = meetingLocation;

    //   if (!isCreating && meeting_id) {
    //     meetingObj.updatedAt = new Date();
    //   }
    // }

    const timezone = req.body.timezone || 'UTC';  // ✅ Get timezone from user if provided
    const meetingProvided = meetingTitle || meetingDescription || meetingStartDate || meetingStartTime || meetingType || meetingEndDate || meetingEndTime;

    if (meetingProvided) {
      // ✅ For online meeting: Check Google connection
      if (meetingType === "online") {
        if (!user.googleAccessToken || !user.googleRefreshToken) {
          return res.status(400).json({
            status: "error",
            message: "To create an online meeting, please first connect your Google account.",
          });
        }
      }

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

      // ✅ Auto-generate Google Meet link for online meetings
      if (meetingType === "online") {
        try {
          const generatedLink = await createGoogleMeetEvent(user, meetingObj, timezone);
          if (generatedLink) {
            meetingObj.meetingLink = generatedLink;
          }
        } catch (error) {
          console.error("Failed to create Google Meet link:", error);
        }
      }

      if (meetingType === "offline" && meetingLocation) {
        meetingObj.meetingLocation = meetingLocation;
      }

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

      const generatedId = new mongoose.Types.ObjectId();

      const contactPayload = {
        _id: generatedId,
        contact_id: generatedId,
        firstname,
        lastname,
        company,
        designation,
        linkedin,
        instagram,
        telegram,
        twitter,
        facebook,
        emailaddresses,
        phonenumbers: parsedPhones,
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
    }
    else {
      const updateFields = {
        firstname,
        lastname,
        company,
        designation,
        linkedin,
        instagram,
        telegram,
        twitter,
        facebook,
        emailaddresses,
        phonenumbers: parsedPhones,
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
    responseData.tags = responseData.tags || [];

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
    delete responseData.updatedAt;
    delete responseData.__v;

    // ---------- Choose Message ----------
    let message = "";
    if (meeting_id) {
      message = "Meeting updated successfully";
    } else if (meetingProvided) {
      message = "Meeting created successfully";
    } else if (task_id) {
      message = "Task updated successfully";
    } else if (taskProvided) {
      message = "Task created successfully";
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
