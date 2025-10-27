const AdminMessage = require("../../models/MessageModel");

// ✅ POST API — Add messages (Super Admin only)
exports.addMessages = async (req, res) => {
  try {
    const { messages } = req.body; // expecting array of text strings
    const userId = req.user._id;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ message: "Messages array is required" });
    }

    // check if existing document exists for this admin
    let adminData = await AdminMessage.findOne({ createdBy: userId });

    if (!adminData) {
      adminData = await AdminMessage.create({
        createdBy: userId,
        messages: messages.map((msg) => ({ text: msg })),
      });
    } else {
      // append new messages
      const newMessages = messages.map((msg) => ({ text: msg }));
      adminData.messages.push(...newMessages);
      await adminData.save();
    }

    return res.status(201).json({
      success: true,
      message: "Messages added successfully",
      data: adminData,
    });
  } catch (error) {
    console.error("Error adding messages:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// ✅ GET API — Get all messages (all users)
exports.getAllMessages = async (req, res) => {
  try {
    // Fetch all admin message documents
    const adminMessages = await AdminMessage.find();

    // Extract all message texts into a single flat array
    const allMessages = adminMessages.flatMap((doc) =>
      doc.messages.map((m) => m.text)
    );

    // Return clean format
    res.status(200).json({
      messages: allMessages,
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

