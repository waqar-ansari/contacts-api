const mongoose = require("mongoose");
const Contact = require("../models/contactModel");
const User = require("../models/userModel");
const s3 = require("../utils/s3");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const path = require("path");
const { createGoogleMeetEvent } = require("../utils/googleCalendar");
const { logActivityToContact } = require("../utils/activityLogger");
const { parsePhoneNumberFromString } = require("libphonenumber-js");
const Plan = require("../models/planModel");
const { getUserCurrentPlan } = require("../utils/stripeUtils");
const {
  sendPushNotification,
  sendPushNotificationToUser,
} = require("../utils/oneSignal");

const addEditContact = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    console.log(user);

    if (!user) {
      return res
        .status(401)
        .json({ status: "error", message: "Unauthorized: User not found" });
    }

    // Get current plan from subscription
    const currentPlan = await getUserCurrentPlan(user);

    let {
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
      phonenumber,
      countryCode,
      isFavourite,
      notes,
      website,
      task_id,
      taskDescription,
      taskDueDate,
      taskDueTime,
      taskIsCompleted,
      meeting_id,
      meetingTitle,
      meetingDescription,
      meetingStartDate,
      meetingStartTime,
      meetingType,
      meetingLocation,
      meetingLink,
      apiType = "web", // "web" | "mobile" | "scan"
    } = req.body;

    let cleanedEmails = [];

    if (emailaddresses) {
      try {
        const parsed =
          typeof emailaddresses === "string"
            ? JSON.parse(emailaddresses)
            : emailaddresses;
        const arrayEmails = Array.isArray(parsed) ? parsed : [parsed];

        cleanedEmails = arrayEmails
          .map((email) => String(email).trim())
          .filter((email) => email !== "");
      } catch (err) {
        if (
          typeof emailaddresses === "string" &&
          emailaddresses.trim() !== ""
        ) {
          cleanedEmails = [emailaddresses.trim()];
        }
      }
    }

    // ---------- Normalize Phone Numbers (Final) ----------
    let parsedPhones = [];
    let hasPhoneInput = false;
    let shouldRemovePhones = false;

    // Detect presence (was the key sent at all?)
    const phonePropPresent = Object.prototype.hasOwnProperty.call(
      req.body,
      "phonenumber"
    );
    const countryPropPresent = Object.prototype.hasOwnProperty.call(
      req.body,
      "countryCode"
    );

    // Raw normalized values (if present) — keep undefined when the property wasn't sent
    const rawPhone = phonePropPresent
      ? (req.body.phonenumber ?? "").toString().trim()
      : undefined;
    const rawCC = countryPropPresent
      ? (req.body.countryCode ?? "").toString().trim()
      : undefined;
    if (phonePropPresent || countryPropPresent) {
      hasPhoneInput = true;

      // If client explicitly sent a phonenumber field that is blank -> treat as "clear" (covers web).
      // Also covers mobile because mobile normally sends phonenumber too.
      if (phonePropPresent && rawPhone === "") {
        shouldRemovePhones = true;
      } else if ((rawPhone && rawPhone !== "") || (rawCC && rawCC !== "")) {
        // Build a candidate international number for parsing
        let full = null;
        // Case: mobile sends countryCode + number separately
        if (rawCC && rawCC !== "" && rawPhone && rawPhone !== "") {
          const ccDigits = rawCC.replace(/[^\d]/g, "");
          const numDigits = rawPhone.replace(/[^\d]/g, "");
          if (ccDigits && numDigits) full = `+${ccDigits}${numDigits}`;
        } else if (rawPhone && rawPhone !== "") {
          // web sends a single phonenumber which may already include the country code
          full = rawPhone.startsWith("+") ? rawPhone : `+${rawPhone}`;
        } else if (rawCC && rawCC !== "") {
          // cc provided but number missing -> don't parse, leave unchanged
          full = null;
        }

        if (full) {
          try {
            const phoneObj = parsePhoneNumberFromString(full);
            if (
              phoneObj &&
              phoneObj.countryCallingCode &&
              phoneObj.nationalNumber
            ) {
              parsedPhones.push({
                countryCode: String(phoneObj.countryCallingCode).replace(
                  /[^\d]/g,
                  ""
                ),
                number: String(phoneObj.nationalNumber).replace(/[^\d]/g, ""),
              });
            }
          } catch (err) {
            console.error(
              "Phone parse error:",
              err && err.message ? err.message : err
            );
          }
        }

        // Fallbacks when parsing fails:
        if (parsedPhones.length === 0 && rawCC && rawPhone) {
          const cleanedCC = rawCC.replace(/[^\d]/g, "");
          const cleanedNum = rawPhone.replace(/[^\d]/g, "");
          if (cleanedCC && cleanedNum) {
            parsedPhones.push({ countryCode: cleanedCC, number: cleanedNum });
          }
        }
        if (parsedPhones.length === 0 && rawPhone) {
          const cleanedNumOnly = rawPhone.replace(/[^\d]/g, "");
          if (cleanedNumOnly) {
            parsedPhones.push({ countryCode: "", number: cleanedNumOnly });
          }
        }
      }
    }

    // ---------- End Normalize Phone Numbers ----------

    // console.log("Parsed Phones:", phonenumbers, parsedPhones);

    // ---------- ✅ Check Duplicate Email or Phone ----------
    const emailList = cleanedEmails;
    const phoneList = parsedPhones;

    let duplicateEmail = false;
    let duplicatePhone = false;

    if (emailList.length || phoneList.length) {
      const duplicateQuery = {
        createdBy: req.user._id,
        $or: [],
      };

      if (contact_id && mongoose.Types.ObjectId.isValid(contact_id)) {
        duplicateQuery._id = { $ne: contact_id };
      }

      if (emailList.length) {
        duplicateQuery.$or.push({ emailaddresses: { $in: emailList } });
      }

      if (phoneList.length) {
        // duplicateQuery.$or.push({ phonenumbers: { $in: phoneList } });
        phoneList.forEach((p) => {
          duplicateQuery.$or.push({
            phonenumbers: {
              $elemMatch: {
                countryCode: p.countryCode,
                number: p.number,
              },
            },
          });
        });
      }

      if (duplicateQuery.$or.length > 0) {
        const existingContacts = await Contact.find(duplicateQuery);

        if (existingContacts.length > 0) {
          for (const contact of existingContacts) {
            if (!duplicateEmail && emailList.length) {
              if (
                contact.emailaddresses.some((email) =>
                  emailList.includes(email)
                )
              ) {
                duplicateEmail = true;
              }
            }

            if (!duplicatePhone && phoneList.length) {
              if (
                contact.phonenumbers.some((phone) =>
                  phoneList.some(
                    (p) =>
                      p.countryCode === phone.countryCode &&
                      p.number === phone.number
                  )
                )
              ) {
                duplicatePhone = true;
              }
            }

            // If both found, stop checking
            if (duplicateEmail && duplicatePhone) break;
          }

          let message = "";
          if (duplicateEmail && duplicatePhone) {
            message =
              "Email address and phone number are already used in another contact.";
          } else if (duplicateEmail) {
            message = "Email address is already used in another contact.";
          } else if (duplicatePhone) {
            message = "Phone number is already used in another contact.";
          }

          return res.status(400).json({
            status: "error",
            message,
          });
        }
      }
    }

    // ---------- ✅ Handle Tags ----------
    let matchedTags = [];
    let tagsProvided = false;

    if (req.body.tags) {
      try {
        const tagsArray = JSON.parse(req.body.tags);

        if (!Array.isArray(tagsArray)) {
          return res.status(400).json({
            status: "error",
            message:
              "Tags must be a valid JSON array of objects with tag/emoji",
          });
        }

        tagsProvided = true; // ✅ Always treat it as provided if it's an array

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
            tagObj = {
              tag_id: existingUserTag.tag_id,
              tag: existingUserTag.tag,
              emoji: existingUserTag.emoji || null,
            };
          } else {
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

    const isCreating = !contact_id || contact_id == "0";
    let meetingWasCreated = false;

    // ---------- Handle Task ----------
    // const taskProvided = taskTitle || taskDescription || taskDueDate || taskDueTime || typeof taskIsCompleted !== "";
    const taskProvided =
      // !!taskTitle ||
      !!taskDescription ||
      !!taskDueDate ||
      !!taskDueTime ||
      typeof taskIsCompleted === "boolean" ||
      taskIsCompleted === "true" ||
      taskIsCompleted === "false";
    if (
      isCreating &&
      taskProvided &&
      (taskIsCompleted === true || taskIsCompleted === "true")
    ) {
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
      if (typeof taskDescription !== "undefined") {
        taskObj.taskDescription = taskDescription || "";
      }
      if (taskDueDate) taskObj.taskDueDate = taskDueDate;
      if (taskDueTime) taskObj.taskDueTime = taskDueTime;

      if (isCreating) {
        taskObj.taskIsCompleted = false;
      } else if (typeof taskIsCompleted !== "undefined") {
        taskObj.taskIsCompleted =
          taskIsCompleted === true || taskIsCompleted === "true";
      }

      if (!isCreating && task_id) {
        taskObj.updatedAt = new Date();
      }
    }

    // ---------- Handle Meeting ----------
    const timezone = req.body.timezone || "UTC"; // ✅ Get timezone from user if provided
    const meetingProvided =
      meetingTitle ||
      meetingDescription ||
      meetingStartDate ||
      meetingStartTime ||
      meetingType;
    let meetingObj = null; // ✅ This line fixes your error

    if (meetingProvided) {
      // ✅ For online meeting: Check Google connection
      if (meetingType === "online") {
        if (!user.googleAccessToken || !user.googleRefreshToken) {
          return res.status(400).json({
            status: "error",
            message:
              "To create an online meeting, please first connect your Google account.",
          });
        }
      }

      meetingObj = {};
      if (meeting_id) {
        meetingObj.meeting_id = new mongoose.Types.ObjectId(meeting_id);

        // ✅ Handle edit logic for existing meeting
        const existingMeeting = await Contact.findOne(
          {
            _id: contact_id,
            createdBy: req.user._id,
            "meetings.meeting_id": meeting_id,
          },
          { "meetings.$": 1 }
        );

        if (
          existingMeeting &&
          existingMeeting.meetings &&
          existingMeeting.meetings.length > 0
        ) {
          const oldMeeting = existingMeeting.meetings[0];
          const oldType = oldMeeting.meetingType;

          // ✅ Step 1: Fill meetingObj with incoming request body values BEFORE type change check
          if (meetingTitle) meetingObj.meetingTitle = meetingTitle;
          if (meetingDescription)
            meetingObj.meetingDescription = meetingDescription;
          if (meetingStartDate) meetingObj.meetingStartDate = meetingStartDate;
          if (meetingStartTime) meetingObj.meetingStartTime = meetingStartTime;
          if (meetingType) meetingObj.meetingType = meetingType;
          if (meetingType === "offline" && meetingLocation) {
            meetingObj.meetingLocation = meetingLocation;
          }
          meetingObj.updatedAt = new Date();

          // ✅ ---- Type change: Offline → Online ----
          if (oldType === "offline" && meetingType === "online") {
            try {
              if (!meetingObj.meetingStartDate) {
                console.error(
                  "Start Date missing during offline → online type change"
                );
              } else {
                const generatedLink = await createGoogleMeetEvent(
                  user,
                  meetingObj,
                  timezone
                );
                if (generatedLink) {
                  meetingObj.meetingLink = generatedLink;
                }
              }
            } catch (error) {
              console.error(
                "Failed to create Google Meet link during type change:",
                error
              );
            }
            meetingObj.meetingLocation = undefined; // Clear location
          }

          // ✅ ---- Type change: Online → Offline ----
          if (oldType === "online" && meetingType === "offline") {
            meetingObj.meetingLink = undefined; // Remove Google Meet link
            if (meetingLocation) {
              meetingObj.meetingLocation = meetingLocation;
            }
          }

          // ✅ ---- Online → Online (Don't change meeting link) ----
          if (oldType === "online" && meetingType === "online") {
            delete meetingObj.meetingLink;
          }

          // ✅ ---- Offline → Offline ----
          if (oldType === "offline" && meetingType === "offline") {
            delete meetingObj.meetingLink;
            meetingObj.meetingLocation = meetingLocation || ""; // ✅ Store blank instead of skipping
          }
        }
      } else {
        // ✅ New meeting creation
        meetingObj.meeting_id = new mongoose.Types.ObjectId();
        meetingObj.createdAt = new Date();

        // ✅ Fill meetingObj with new values
        if (meetingTitle) meetingObj.meetingTitle = meetingTitle;
        if (meetingDescription)
          meetingObj.meetingDescription = meetingDescription;
        if (meetingStartDate) meetingObj.meetingStartDate = meetingStartDate;
        if (meetingStartTime) meetingObj.meetingStartTime = meetingStartTime;
        if (meetingType) meetingObj.meetingType = meetingType;
        if (meetingType === "offline" && meetingLocation) {
          meetingObj.meetingLocation = meetingLocation;
        }

        // ✅ Google Meet creation for new meeting (if online)
        if (meetingType === "online") {
          try {
            if (!meetingObj.meetingStartDate) {
              console.error(
                "Meeting Start Date missing for new Google Meet creation!"
              );
            } else {
              const generatedLink = await createGoogleMeetEvent(
                user,
                meetingObj,
                timezone
              );
              if (generatedLink) {
                meetingObj.meetingLink = generatedLink;
              }
            }
          } catch (error) {
            console.error(
              "Failed to create Google Meet link for new meeting:",
              error
            );
          }
        }
      }
    }

    let contactData;
    if (isCreating) {
      const planName = currentPlan?.name?.toLowerCase() || "starter";
      let contactLimit = 1000; // default for Free
      if (planName === "pro") {
        contactLimit = Infinity; // unlimited
      }
      const currentContactCount = await Contact.countDocuments({
        createdBy: user._id,
      });
      if (currentContactCount >= contactLimit) {
        return res.status(403).json({
          status: "error",
          message:
            planName === "pro"
              ? "You have reached your contact limit. Please contact support."
              : "You have reached the maximum number of contacts allowed for your plan. Upgrade to Pro for unlimited contacts.",
        });
      }

      if (taskProvided && task_id) {
        return res.status(400).json({
          status: "error",
          message:
            "Task ID should not be provided when creating a contact with a task.",
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
        emailaddresses: cleanedEmails,
        phonenumbers: parsedPhones,
        contactImageURL: contactImage,
        isFavourite,
        notes,
        website,
        createdBy: req.user._id,
      };

      if (matchedTags.length > 0) contactPayload.tags = matchedTags;
      if (taskObj) contactPayload.tasks = [taskObj];
      // if (meetingObj) contactPayload.meetings = [meetingObj];
      if (meetingObj) {
        contactPayload.meetings = [meetingObj];
        meetingWasCreated = true; // <-- mark that a meeting was created during contact creation
      }

      contactData = await Contact.create(contactPayload);

      //activity logging
      await logActivityToContact(contactData._id, {
        action: "contact_created",
        type: "contact", // ✅ this is important
        title: `Contact Created`,
        description: ` ${firstname} ${lastname}`,
      });
    } else {
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
        // emailaddresses,
        // phonenumbers: parsedPhones,
        isFavourite,
        notes,
        website,
      };

      // Apply phone updates only when client intended a change
      if (hasPhoneInput) {
        if (shouldRemovePhones) {
          // client sent both phone & country as blank -> clear phone numbers
          updateFields.phonenumbers = [];
        } else if (parsedPhones.length > 0) {
          // parsed successfully -> update to parsedPhones
          updateFields.phonenumbers = parsedPhones;
        } else {
          // phone props present but nothing parsed -> do NOT change db value (avoid accidental deletion)
        }
      }

      if (
        req.body.emailaddresses !== undefined &&
        Array.isArray(cleanedEmails)
      ) {
        updateFields.emailaddresses = cleanedEmails;
      }

      if (contactImage) updateFields.contactImageURL = contactImage;
      if (tagsProvided) updateFields.tags = matchedTags;

      // ---------- ✅ Activity Logging for Tag Changes ----------
      if (tagsProvided) {
        const existing = await Contact.findOne({
          _id: contact_id,
          createdBy: req.user._id,
        });

        const oldTags = existing.tags?.map((t) => t.tag) || [];
        const newTags = matchedTags.map((t) => t.tag);

        const addedTags = newTags.filter((tag) => !oldTags.includes(tag));
        const removedTags = oldTags.filter((tag) => !newTags.includes(tag));

        if (addedTags.length) {
          await logActivityToContact(contact_id, {
            action: "tags_added",
            type: "tag",
            title: "Added tags",
            description: addedTags.join(", "),
          });
        }

        if (removedTags.length) {
          await logActivityToContact(contact_id, {
            action: "tags_removed",
            type: "tag",
            title: "Removed tags",
            description: removedTags.join(", "),
          });
        }
      }

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
        const taskIndex = contactData.tasks.findIndex(
          (task) => task?.task_id?.toString() === taskObj.task_id.toString()
        );

        if (taskIndex >= 0) {
          Object.assign(contactData.tasks[taskIndex], {
            ...taskObj,
            taskIsCompleted:
              taskObj.taskIsCompleted !== undefined
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

        //activity logging for task
        await logActivityToContact(contactData._id, {
          action: task_id ? "task_updated" : "task_created",
          type: "task",
          title: task_id ? "Note Updated" : "Note Created",
          description: `${taskDescription}`,
        });
      }

      // ----- Update or Add Meeting -----
      if (meetingObj) {
        const meetingIndex =
          contactData.meetings?.findIndex(
            (meeting) =>
              meeting?.meeting_id?.toString() ===
              meetingObj.meeting_id.toString()
          ) ?? -1;

        if (meetingIndex >= 0) {
          Object.assign(contactData.meetings[meetingIndex], meetingObj);
          contactData.markModified("meetings");
        } else {
          meetingObj.createdAt = new Date();
          if (!contactData.meetings) contactData.meetings = [];
          contactData.meetings.unshift(meetingObj);
          meetingWasCreated = true; // <-- mark that we added a new meeting on update
        }

        contactData.updatedAt = new Date();
        await logActivityToContact(contactData._id, {
          action: meeting_id ? "meeting_updated" : "meeting_created",
          type: "meeting",
          title: meeting_id ? "Meeting Updated" : "Meeting Scheduled",
          description: `${meetingTitle}`,
        });
      }

      await contactData.save();

      // ---------- OneSignal Push: notify user(s) if a meeting was newly created ----------
      if (meetingWasCreated) {
        try {
          console.log("meetingWasCreated is true; starting OneSignal flow");
          // Collect unique users to notify based on contact phone numbers
          const notifiedUserIds = new Set();

          if (
            Array.isArray(contactData.phonenumbers) &&
            contactData.phonenumbers.length
          ) {
            for (const p of contactData.phonenumbers) {
              const cc = String(p.countryCode ?? "").replace(/[^\d]/g, "");
              const num = String(p.number ?? "").replace(/[^\d]/g, "");
              if (!num) continue;

              // Find user who has this phone number
              const matchedUser = await User.findOne({
                phonenumbers: {
                  $elemMatch: {
                    countryCode: cc,
                    number: num,
                  },
                },
              });

              if (!matchedUser) continue;
              const uid = String(matchedUser._id);
              if (notifiedUserIds.has(uid)) continue; // Already notified this user
              notifiedUserIds.add(uid);

              // Use the new optimized function to send notification by user ID
              const heading = "Meeting Scheduled";
              const content = `Meeting scheduled with ${
                contactData.firstname || ""
              } ${contactData.lastname || ""}${
                meetingObj.meetingStartDate
                  ? " on " + meetingObj.meetingStartDate
                  : ""
              }${
                meetingObj.meetingStartTime
                  ? " at " + meetingObj.meetingStartTime
                  : ""
              }`;

              try {
                await sendPushNotificationToUser(matchedUser._id, {
                  heading,
                  content,
                  data: {
                    contact_id: String(contactData._id),
                    meeting_id: String(meetingObj.meeting_id),
                    type: "meeting_created",
                  },
                });
                console.log(
                  `OneSignal: notification sent to user ${matchedUser._id}`
                );
              } catch (err) {
                console.error(
                  "OneSignal send error:",
                  err && err.response?.data
                    ? err.response.data
                    : err.message || err
                );
              }
            } // end for phonenumbers
          } // end if contactData.phonenumbers
        } catch (err) {
          console.error("OneSignal notification flow failed:", err);
        }
      } // end if meetingWasCreated

      // Log contact_updated ONLY if no task, meeting, or tag was updated
      const nothingElseChanged = !taskObj && !meetingObj && !tagsProvided;

      if (nothingElseChanged) {
        await logActivityToContact(contactData._id, {
          action: "contact_updated",
          type: "contact",
          title: "Contact Updated",
          description: `${contactData.firstname} ${contactData.lastname}`,
        });
      }
    }

    // ---------- Format Response ----------
    const responseData = contactData.toObject();
    responseData.contact_id = responseData._id;
    responseData.tags = responseData.tags || [];

    if (responseData.tasks?.length) {
      responseData.tasks = responseData.tasks.map((t) => ({
        task_id: t.task_id,
        // taskTitle: t.taskTitle,
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
        meetingType: m.meetingType,
        meetingLocation: m.meetingLocation,
        meetingLink: m.meetingLink,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      }));
    }

    // ---- Response: format phonenumbers depending on apiType ----
    // If contact has phonenumbers, convert the shape for web/mobile/scan
    if (Array.isArray(responseData.phonenumbers)) {
      if (apiType === "web") {
        // For web -> return array of strings like ["9170565456655"]
        responseData.phonenumbers = responseData.phonenumbers
          .map((p) => {
            if (typeof p === "string") {
              // remove leading + if present and non-digit chars
              return String(p).replace(/^\+/, "").replace(/[^\d]/g, "");
            }
            const cc = String(p.countryCode ?? "").replace(/[^\d]/g, "");
            const num = String(p.number ?? p.nationalNumber ?? "").replace(
              /[^\d]/g,
              ""
            );
            return cc && num ? cc + num : cc || num ? cc + num : "";
          })
          .filter(Boolean); // remove empty strings
      } else {
        // For mobile/scan (and other types) -> keep object form { countryCode, number }
        // Also normalize strings into objects where possible
        responseData.phonenumbers = responseData.phonenumbers.map((p) => {
          if (typeof p === "string") {
            // try to parse string using libphonenumber (you already imported parsePhoneNumberFromString)
            const raw = p.startsWith("+") ? p : "+" + p;
            const parsed = parsePhoneNumberFromString(raw);
            if (parsed) {
              return {
                countryCode: String(parsed.countryCallingCode).replace(
                  /[^\d]/g,
                  ""
                ),
                number: String(parsed.nationalNumber).replace(/[^\d]/g, ""),
              };
            }
            // fallback: return cleaned string (no plus)
            return {
              countryCode: "",
              number: String(p).replace(/^\+/, "").replace(/[^\d]/g, ""),
            };
          }
          // already an object — ensure digits-only strings
          return {
            countryCode: String(p.countryCode ?? "").replace(/[^\d]/g, ""),
            number: String(p.number ?? p.nationalNumber ?? "").replace(
              /[^\d]/g,
              ""
            ),
          };
        });
      }
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
      message = "Note updated successfully";
    } else if (taskProvided) {
      message = "Note created successfully";
    } else {
      message = isCreating
        ? "Contact created successfully"
        : "Contact updated successfully";
    }

    return res.status(isCreating ? 201 : 200).json({
      status: "success",
      message,
      data: responseData,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ status: "error", message: "An error occurred" });
  }
};

module.exports = { addEditContact };
