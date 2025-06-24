const path = require("path");
const mongoose = require("mongoose");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const User = require("../models/userModel");
const s3 = require("../utils/s3");
const { generateUserQRCode } = require("../utils/qrUtils");


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
      linkedin,
      instagram,
      telegram,
      twitter,
      facebook,
      designation,
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

    let updatedWhatsappTemplate;
    let updatedEmailTemplate;

    // === WhatsApp Template Edit ===
    if (whatsappTemplate_id) {
      const index = user.whatsappTemplates.findIndex(
        tpl => tpl.whatsappTemplate_id?.toString() === whatsappTemplate_id.toString()
      );

      if (index !== -1) {
        if (whatsappTemplateTitle) user.whatsappTemplates[index].whatsappTemplateTitle = whatsappTemplateTitle;
        if (whatsappTemplateMessage) user.whatsappTemplates[index].whatsappTemplateMessage = whatsappTemplateMessage;
        if (typeof whatsappTemplateIsFavourite !== 'undefined') {
          user.whatsappTemplates[index].whatsappTemplateIsFavourite = whatsappTemplateIsFavourite;
        }
        updatedWhatsappTemplate = user.whatsappTemplates[index];
      } else {
        return res.status(404).json({ status: "error", message: "WhatsApp template not found" });
      }
    }

    // === WhatsApp Template Add ===
    if (!whatsappTemplate_id && whatsappTemplateTitle && whatsappTemplateMessage) {
      const newWhatsappTemplate = {
        whatsappTemplate_id: new mongoose.Types.ObjectId(),
        whatsappTemplateTitle,
        whatsappTemplateMessage,
        whatsappTemplateIsFavourite: !!whatsappTemplateIsFavourite,
      };
      user.whatsappTemplates.unshift(newWhatsappTemplate);
      updatedWhatsappTemplate = newWhatsappTemplate;
    }

    // === Email Template Edit ===
    if (emailTemplate_id) {
      const index = user.emailTemplates.findIndex(
        tpl => tpl.emailTemplate_id?.toString() === emailTemplate_id.toString()
      );

      if (index !== -1) {
        if (emailTemplateTitle) user.emailTemplates[index].emailTemplateTitle = emailTemplateTitle;
        if (emailTemplateSubject) user.emailTemplates[index].emailTemplateSubject = emailTemplateSubject;
        if (emailTemplateBody) user.emailTemplates[index].emailTemplateBody = emailTemplateBody;
        if (typeof emailTemplateIsFavourite !== 'undefined') {
          user.emailTemplates[index].emailTemplateIsFavourite = emailTemplateIsFavourite;
        }
        updatedEmailTemplate = user.emailTemplates[index];
      } else {
        return res.status(404).json({ status: "error", message: "Email template not found" });
      }
    }

    // === Email Template Add ===
    if (!emailTemplate_id && emailTemplateTitle && emailTemplateSubject && emailTemplateBody) {
      const newEmailTemplate = {
        emailTemplate_id: new mongoose.Types.ObjectId(),
        emailTemplateTitle,
        emailTemplateSubject,
        emailTemplateBody,
        emailTemplateIsFavourite: !!emailTemplateIsFavourite,
      };
      user.emailTemplates.unshift(newEmailTemplate);
      updatedEmailTemplate = newEmailTemplate;
    }

    // === Update Basic Info ===
    if (!whatsappTemplate_id && !emailTemplate_id && !whatsappTemplateTitle && !emailTemplateTitle) {
      // if (firstname) user.firstname = firstname;
      // if (lastname) user.lastname = lastname;
      // if (email) user.email = email;
      // if (linkedin) user.linkedin = linkedin;
      // if (instagram) user.instagram = instagram;
      // if (telegram) user.telegram = telegram;
      // if (twitter) user.twitter = twitter;
      // if (facebook) user.facebook = facebook;
      // if (designation) user.designation = designation;

      const keys = Object.keys(req.body);

      if (keys.includes('firstname')) user.firstname = firstname;
      if (keys.includes('lastname')) user.lastname = lastname;
      if (keys.includes('email')) user.email = email;
      if (keys.includes('linkedin')) user.linkedin = linkedin;
      if (keys.includes('instagram')) user.instagram = instagram;
      if (keys.includes('telegram')) user.telegram = telegram;
      if (keys.includes('twitter')) user.twitter = twitter;
      if (keys.includes('facebook')) user.facebook = facebook;
      if (keys.includes('designation')) user.designation = designation;
      // if (keys.includes('phonenumbers')) {
      //   let parsedPhones;

      //   try {
      //     // If it's a stringified array, parse it
      //     parsedPhones = JSON.parse(phonenumbers);

      //     // If JSON-parsed value is a single number (not array), wrap in array
      //     if (!Array.isArray(parsedPhones)) {
      //       parsedPhones = [parsedPhones];
      //     }
      //   } catch {
      //     // If not JSON (plain string like '8546892104'), wrap in array
      //     parsedPhones = [phonenumbers];
      //   }

      //   // ✅ Normalize: remove '+' and non-digit characters (optional)
      //   user.phonenumbers = parsedPhones.map(num => {
      //     if (typeof num === 'string') {
      //       return num.replace(/[^\d]/g, ""); // remove +, spaces, etc.
      //     }
      //     return String(num);
      //   });
      // }

      if (keys.includes('phonenumbers')) {
        let parsedPhones;

        try {
          parsedPhones = JSON.parse(phonenumbers);
          if (!Array.isArray(parsedPhones)) parsedPhones = [parsedPhones];
        } catch {
          parsedPhones = [phonenumbers];
        }

        user.phonenumbers = parsedPhones
          .map(num => typeof num === 'string' ? num.replace(/[^\d]/g, "") : String(num))
          .filter(num => num !== ""); // ✅ Remove empty strings
      }


      // if (phonenumbers) {
      //   try {
      //     user.phonenumbers = JSON.parse(phonenumbers);
      //   } catch {
      //     user.phonenumbers = Array.isArray(phonenumbers) ? phonenumbers : [phonenumbers];
      //   }
      // }


      if (req.file) {
        const profileImage = await uploadImageToS3(req.file);
        user.profileImageURL = profileImage;
      }
      // else if (!user.profileImageURL) {
      //   user.profileImageURL = "/images/defaultUserPic.png";
      // }
    }

    const { qrCode } = await generateUserQRCode(user.firstname || "user", user.serialNumber, {
      firstname: user.firstname,
      lastname: user.lastname,
      phonenumbers: user.phonenumbers,
      email: user.email,
      provider: "local"
    });

    user.qrcode = qrCode;


    await user.save();

    // === Response ===
    if (updatedWhatsappTemplate || updatedEmailTemplate) {
      const responseData = {
        id: user._id,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        phonenumbers: user.phonenumbers,
        qrcode: user.qrcode,
        linkedin: user.linkedin,
        instagram: user.instagram,
        telegram: user.telegram,
        twitter: user.twitter,
        facebook: user.facebook,
        designation: user.designation,
        provider: user.provider,
        profileImageURL: user.profileImageURL,
        templates: {}
      };

      if (updatedWhatsappTemplate) {
        responseData.templates.whatsappTemplates = {
          whatsappTemplatesData: [updatedWhatsappTemplate]
        };
      }

      if (updatedEmailTemplate) {
        responseData.templates.emailTemplates = {
          emailTemplatesData: [updatedEmailTemplate]
        };
      }

      return res.status(200).json({
        status: "success",
        message: "Template added or updated successfully",
        data: responseData,
      });
    } else {
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
          qrcode: user.qrcode,
          linkedin: user.linkedin,
          instagram: user.instagram,
          telegram: user.telegram,
          twitter: user.twitter,
          facebook: user.facebook,
          designation: user.designation,
          provider: user.provider,
          // whatsappTemplates: user.whatsappTemplates,
          // emailTemplates: user.emailTemplates,
        },
      });
    }
  } catch (error) {
    console.error("Edit Profile Error:", error);
    return res.status(500).json({ status: "error", message: "Server error" });
  }
};

module.exports = { editProfile };
