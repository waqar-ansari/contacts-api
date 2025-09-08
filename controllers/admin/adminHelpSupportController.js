const mongoose = require("mongoose");
const HelpSupport = require("../../models/helpSupportModel");
const User = require("../../models/userModel");
const { sendHelpSupportReply } = require("../../utils/emailUtils");

// GET all help support tickets
const getAllHelpSupportTickets = async (req, res) => {
  try {
    console.log("Fetching all help support tickets");

    const {
      page = 1,
      limit = 10,
      inquiryType,
      sortBy = "createdAt",
      sortOrder = "desc",
      search,
    } = req.query;

    // Build filter query
    let filter = {};

    if (inquiryType && inquiryType !== "All") {
      filter.inquiryType = inquiryType;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { subject: { $regex: search, $options: "i" } },
        { message: { $regex: search, $options: "i" } },
        { emailaddresses: { $regex: search, $options: "i" } },
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Get tickets with user details
    const tickets = await HelpSupport.find(filter)
      .populate({
        path: "userId",
        select: "firstname lastname email phonenumbers",
      })
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalTickets = await HelpSupport.countDocuments(filter);
    const totalPages = Math.ceil(totalTickets / parseInt(limit));

    // Get summary statistics
    const stats = await HelpSupport.aggregate([
      {
        $group: {
          _id: "$inquiryType",
          count: { $sum: 1 },
        },
      },
    ]);

    const totalCount = await HelpSupport.countDocuments();

    res.status(200).json({
      status: "success",
      message: "Help support tickets retrieved successfully",
      data: {
        tickets,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalTickets,
          limit: parseInt(limit),
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
        },
        stats: {
          total: totalCount,
          byType: stats.reduce((acc, curr) => {
            acc[curr._id] = curr.count;
            return acc;
          }, {}),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching help support tickets:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// GET single help support ticket by ID
const getHelpSupportTicketById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid ticket ID",
      });
    }

    const ticket = await HelpSupport.findById(id).populate({
      path: "userId",
      select: "firstname lastname email phonenumbers profileImage",
    });

    if (!ticket) {
      return res.status(404).json({
        status: "error",
        message: "Help support ticket not found",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Help support ticket retrieved successfully",
      data: ticket,
    });
  } catch (error) {
    console.error("Error fetching help support ticket:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// POST - Reply to help support ticket
const replyToHelpSupportTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminReply } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid ticket ID",
      });
    }

    if (!adminReply || adminReply.trim() === "") {
      return res.status(400).json({
        status: "error",
        message: "Admin reply is required",
      });
    }

    // Find the ticket with user details
    const ticket = await HelpSupport.findById(id).populate({
      path: "userId",
      select: "firstname lastname email",
    });

    if (!ticket) {
      return res.status(404).json({
        status: "error",
        message: "Help support ticket not found",
      });
    }

    // Get user's primary email
    let userEmail = null;
    if (ticket.userId && ticket.userId.email) {
      userEmail = ticket.userId.email;
    } else if (ticket.emailaddresses && ticket.emailaddresses.length > 0) {
      userEmail = ticket.emailaddresses[0];
    }

    if (!userEmail) {
      return res.status(400).json({
        status: "error",
        message: "No email address found for this user",
      });
    }

    // Send email reply
    const userName = ticket.userId
      ? `${ticket.userId.firstname || ""} ${
          ticket.userId.lastname || ""
        }`.trim()
      : ticket.name || "Valued Customer";

    await sendHelpSupportReply(
      userEmail,
      userName,
      ticket.message,
      adminReply.trim(),
      ticket.subject
    );

    // Update ticket with reply info (optional: you can add a replies array to the schema)
    await HelpSupport.findByIdAndUpdate(id, {
      $set: {
        lastRepliedAt: new Date(),
        adminReply: adminReply.trim(),
        repliedBy: req.user._id, // Admin who replied
      },
    });

    res.status(200).json({
      status: "success",
      message: "Reply sent successfully",
      data: {
        sentTo: userEmail,
        userName,
        repliedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Error replying to help support ticket:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// DELETE help support ticket
const deleteHelpSupportTicket = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid ticket ID",
      });
    }

    const ticket = await HelpSupport.findByIdAndDelete(id);

    if (!ticket) {
      return res.status(404).json({
        status: "error",
        message: "Help support ticket not found",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Help support ticket deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting help support ticket:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// GET help support dashboard stats
const getHelpSupportStats = async (req, res) => {
  try {
    // Get current date for filtering
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get total tickets
    const totalTickets = await HelpSupport.countDocuments();

    // Get tickets by inquiry type
    const ticketsByType = await HelpSupport.aggregate([
      {
        $group: {
          _id: "$inquiryType",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get recent tickets (today, this week, this month)
    const todayTickets = await HelpSupport.countDocuments({
      createdAt: { $gte: startOfDay },
    });

    const thisWeekTickets = await HelpSupport.countDocuments({
      createdAt: { $gte: startOfWeek },
    });

    const thisMonthTickets = await HelpSupport.countDocuments({
      createdAt: { $gte: startOfMonth },
    });

    // Get tickets with replies
    const repliedTickets = await HelpSupport.countDocuments({
      adminReply: { $exists: true, $ne: null },
    });

    const pendingTickets = totalTickets - repliedTickets;

    res.status(200).json({
      status: "success",
      message: "Help support statistics retrieved successfully",
      data: {
        overview: {
          total: totalTickets,
          replied: repliedTickets,
          pending: pendingTickets,
          today: todayTickets,
          thisWeek: thisWeekTickets,
          thisMonth: thisMonthTickets,
        },
        byType: ticketsByType.reduce((acc, curr) => {
          acc[curr._id] = curr.count;
          return acc;
        }, {}),
        replyRate:
          totalTickets > 0
            ? ((repliedTickets / totalTickets) * 100).toFixed(2)
            : 0,
      },
    });
  } catch (error) {
    console.error("Error fetching help support stats:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

module.exports = {
  getAllHelpSupportTickets,
  getHelpSupportTicketById,
  replyToHelpSupportTicket,
  deleteHelpSupportTicket,
  getHelpSupportStats,
};
