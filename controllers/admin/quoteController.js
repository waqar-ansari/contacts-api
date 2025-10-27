const AdminQuote = require("../../models/QuoteModel");

// ✅ POST API — Add quotes (Super Admin only)
exports.addQuotes = async (req, res) => {
  try {
    const { quotes } = req.body; // expecting array of quote strings
    const userId = req.user._id;

    if (!quotes || !Array.isArray(quotes) || quotes.length === 0) {
      return res.status(400).json({ message: "Quotes array is required" });
    }

    // check if existing document exists for this admin
    let adminData = await AdminQuote.findOne({ createdBy: userId });

    if (!adminData) {
      adminData = await AdminQuote.create({
        createdBy: userId,
        quotes: quotes.map((q) => ({ quoteText: q })),
      });
    } else {
      // append new quotes
      const newQuotes = quotes.map((q) => ({ quoteText: q }));
      adminData.quotes.push(...newQuotes);
      await adminData.save();
    }

    return res.status(201).json({
      success: true,
      message: "Quotes added successfully",
      data: adminData,
    });
  } catch (error) {
    console.error("Error adding quotes:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// ✅ GET API — Get all quotes (for all users)
exports.getAllQuotes = async (req, res) => {
  try {
    // Fetch all admin quote documents
    const adminQuotes = await AdminQuote.find();

    // Extract all quote texts into a single flat array
    const allQuotes = adminQuotes.flatMap((doc) =>
      doc.quotes.map((q) => q.quoteText)
    );

    // Return clean format
    res.status(200).json({
      quotes: allQuotes,
    });
  } catch (error) {
    console.error("Error fetching quotes:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
