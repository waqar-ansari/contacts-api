// const HelpSupport = require("../models/helpSupportModel");
// const s3 = require("../utils/s3");

// const uploadImageToS3 = async (file) => {
//     const ext = path.extname(file.originalname);
//     const name = path.basename(file.originalname, ext);
//     const fileName = `helpAndSupportAttachments/${name}_${Date.now()}${ext}`;
//     const params = {
//         Bucket: process.env.AWS_BUCKET_NAME,
//         Key: fileName,
//         Body: file.buffer,
//         ContentType: file.mimetype,
//     };
//     try {
//         await s3.send(new PutObjectCommand(params));
//         return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
//     } catch (error) {
//         console.error("S3 upload failed:", error);
//         throw new Error("Image upload failed");
//     }
// };

const path = require("path");
const mongoose = require("mongoose");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const HelpSupport = require("../models/helpSupportModel");
const s3 = require("../utils/s3");
const User = require("../models/userModel");


// Upload file to S3
const uploadImageToS3 = async (file) => {
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    const fileName = `helpAndSupportAttachments/${name}_${Date.now()}${ext}`;

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

// Create Help & Support Request
const createHelpSupport = async (req, res) => {
    try {
        const userId = req.user._id;

        const {
            name,
            subject,
            emailaddresses,
            phonenumber,
            countryCode,
            inquiryType,
            message,
            subscribe,
        } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ status: "error", message: "User not found" });
        }

        console.log(req.body.name);


        console.log("Received Help & Support request:", {
            userId,
            name,
            subject,
            emailaddresses,
            phonenumber,
            countryCode,
            inquiryType,
            message,
            subscribe,
            file: req.file ? req.file.originalname : null,
        });


        // ✅ file comes from multer
        let fileUrl = null;
        if (req.file) {
            fileUrl = await uploadImageToS3(req.file);
        }

        // ✅ parse emailaddresses (JSON array or single string)
        let parsedEmails = [];
        if (emailaddresses) {
            try {
                parsedEmails = Array.isArray(emailaddresses)
                    ? emailaddresses
                    : JSON.parse(emailaddresses);
            } catch {
                parsedEmails = [emailaddresses];
            }
        }

        // ✅ parse phone
        let parsedPhones = [];
        if (phonenumber && countryCode) {
            parsedPhones.push({
                countryCode: String(countryCode).replace(/[^\d]/g, ""),
                number: String(phonenumber).replace(/[^\d]/g, ""),
            });
        }

        const helpRequest = new HelpSupport({
            userId,
            name,
            subject,
            emailaddresses: parsedEmails,
            phonenumbers: parsedPhones,
            inquiryType,
            message,
            fileUrl,
            subscribe: subscribe === "true" || subscribe === true,
        });

        await helpRequest.save();

        res.status(201).json({
            status: "success",
            message: "Help & Support request submitted successfully",
            data: helpRequest,
        });
    } catch (error) {
        console.error("Error creating help support:", error);
        res.status(500).json({
            status: "error",
            message: error.message,
        });
    }
};

// Get all requests of a user
const getUserHelpRequests = async (req, res) => {
    try {
        // const { userId } = req.params;

        const userId = req.user._id;

        const requests = await HelpSupport.find({ userId }).sort({ createdAt: -1 });

        res.status(200).json({
            status: "success",
            message: "Help & Support requests fetched successfully",
            data: requests,
        });
    } catch (error) {
        res.status(500).json({
            status: "error",
            message: error.message,
        });
    }
};

module.exports = { createHelpSupport, getUserHelpRequests };