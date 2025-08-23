const HelpSupport = require("../models/helpSupportModel");
const s3 = require("../utils/s3");

// Create Help & Support Request
exports.createHelpSupport = async (req, res) => {
    try {
        let userId = req.user._id;
        const {
            name,
            subject,
            emailaddresses,
            phonenumber,   // single phone number from request
            countryCode,   // single country code from request
            inquiryType,
            message,
            subscribe,
        } = req.body;

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

        let fileUrl = null;
        if (req.file) {
            fileUrl = await uploadImageToS3(req.file);
        }

        // Parse emails (allow JSON array or single string)
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

        // Parse phone (ensure digits only)
        let parsedPhones = [];
        if (phonenumber && countryCode) {
            parsedPhones.push({
                countryCode: String(countryCode).replace(/[^\d]/g, ""), // remove +
                number: String(phonenumber).replace(/[^\d]/g, ""),      // keep only digits
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
        res.status(500).json({
            status: "error",
            message: error.message,
        });
    }
};

// Get all requests of a user
exports.getUserHelpRequests = async (req, res) => {
    try {
        // const { userId } = req.params;

        const userId = req.user._id;

        const requests = await HelpSupport.find({ userId }).sort({ createdAt: -1 });

        res.status(200).json({
            status: "success",
            data: requests,
        });
    } catch (error) {
        res.status(500).json({
            status: "error",
            message: error.message,
        });
    }
};
