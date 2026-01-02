const path = require("path");
const mongoose = require("mongoose");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const HelpSupport = require("../models/helpSupportModel");
const s3 = require("../utils/s3");
const User = require("../models/userModel");
// ADD this at the top (with your other requires)
const { parsePhoneNumberFromString } = require("libphonenumber-js");

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
      apiType = "web", // <-- ADDED (defaults to "web")
    } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ status: "error", message: "User not found" });
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
    // let parsedPhones = [];
    // if (phonenumber && countryCode) {
    //     parsedPhones.push({
    //         countryCode: String(countryCode).replace(/[^\d]/g, ""),
    //         number: String(phonenumber).replace(/[^\d]/g, ""),
    //     });
    // }

    // ✅ parse phone(s) by apiType
    let parsedPhones = [];

    if (phonenumber && countryCode) {
      parsedPhones.push({
        countryCode: String(countryCode).replace(/[^\d]/g, ""), // keep only digits
        number: String(phonenumber).replace(/[^\d]/g, ""), // keep only digits
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
    const userId = req.user._id;
    const { page = 1, limit = 10 } = req.query;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const requests = await HelpSupport.find({ userId })
      .populate({
        path: "messages.senderInfo",
        select: "firstname lastname email role",
      })
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalTickets = await HelpSupport.countDocuments({ userId });
    const totalPages = Math.ceil(totalTickets / parseInt(limit));

    res.status(200).json({
      status: "success",
      message: "Help & Support requests fetched successfully",
      data: {
        tickets: requests,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalTickets,
          limit: parseInt(limit),
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// Get single ticket by ID for the current user
const getTicketById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid ticket ID",
      });
    }

    const ticket = await HelpSupport.findOne({ _id: id, userId }).populate({
      path: "messages.senderInfo",
      select: "firstname lastname email role",
    });

    if (!ticket) {
      return res.status(404).json({
        status: "error",
        message: "Ticket not found",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Ticket retrieved successfully",
      data: ticket,
    });
  } catch (error) {
    console.error("Error fetching ticket:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// Reply to a ticket (customer reply)
const replyToTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid ticket ID",
      });
    }

    if (!message || message.trim() === "") {
      return res.status(400).json({
        status: "error",
        message: "Message is required",
      });
    }

    // Find the ticket and verify ownership
    const ticket = await HelpSupport.findOne({ _id: id, userId });

    if (!ticket) {
      return res.status(404).json({
        status: "error",
        message: "Ticket not found",
      });
    }

    // Add new message to the chat
    const newMessage = {
      sender: "customer",
      content: message.trim(),
      timestamp: new Date(),
      senderInfo: userId,
    };

    // Update ticket with new message
    await HelpSupport.findByIdAndUpdate(id, {
      $push: { messages: newMessage },
      $set: {
        lastMessageAt: new Date(),
      },
    });

    res.status(200).json({
      status: "success",
      message: "Reply sent successfully",
      data: {
        messageId: newMessage._id,
        timestamp: newMessage.timestamp,
      },
    });
  } catch (error) {
    console.error("Error replying to ticket:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// Delete ticket by ID for the current user
const deleteTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid ticket ID",
      });
    }

    // Find and delete the ticket, but only if it belongs to the current user
    const ticket = await HelpSupport.findOneAndDelete({
      _id: id,
      userId: userId, // Ensure the ticket belongs to the current user
    });

    if (!ticket) {
      return res.status(404).json({
        status: "error",
        message: "Ticket not found or you don't have permission to delete it",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Ticket deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting ticket:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

module.exports = {
  createHelpSupport,
  getUserHelpRequests,
  getTicketById,
  replyToTicket,
  deleteTicket,
};
