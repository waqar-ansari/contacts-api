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

// // ✅ GET API — Get all quotes (for all users)
// exports.getAllQuotes = async (req, res) => {
//   try {
//     // Fetch all admin quote documents
//     const adminQuotes = await AdminQuote.find();

//     // Extract all quote texts into a single flat array
//     const allQuotes = adminQuotes

//     // Return clean format
//     res.status(200).json({
//       quotes: allQuotes,
//     });
//   } catch (error) {
//     console.error("Error fetching quotes:", error);
//     res.status(500).json({ message: "Internal Server Error" });
//   }
// };

exports.getAllQuotes = async (req, res) => {
  try {
    // Get the current admin's ID from the token
    const userId = req.user._id;

    // Find the admin's quotes document
    const adminQuotes = await AdminQuote.findOne({ createdBy: userId });

    // If no quotes found for this admin
    if (!adminQuotes || !adminQuotes.quotes || adminQuotes.quotes.length === 0) {
      return res.status(200).json({
        quotes: [],
        message: "No quotes found for this admin.",
      });
    }

    // Extract all quote texts into an array
    const allQuotes = adminQuotes.quotes;

    // Return clean format
    res.status(200).json({
      quotes: allQuotes,
    });
  } catch (error) {
    console.error("Error fetching quotes:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

exports.editQuote = async (req, res) => {
  try {
    const userId = req.user._id;
    const { quote_id, newText } = req.body;

    if (!quote_id || !newText) {
      return res.status(400).json({ message: "quote_id and newText are required" });
    }

    // Find the admin's document
    const adminQuotes = await AdminQuote.findOne({ createdBy: userId });
    if (!adminQuotes) {
      return res.status(404).json({ message: "Admin quotes not found" });
    }

    // Find the quote to edit
    const quote = adminQuotes.quotes.find(
      (q) => q.quote_id.toString() === quote_id
    );
    if (!quote) {
      return res.status(404).json({ message: "Quote not found" });
    }

    // Update text
    quote.quoteText = newText;
    await adminQuotes.save();

    res.status(200).json({
      success: true,
      message: "Quote updated",
      updatedQuote: quote,
    });
  } catch (error) {
    console.error("Error editing quote:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

exports.deleteQuote = async (req, res) => {
  try {
    const userId = req.user._id;
    const { quote_id } = req.body;

    if (!quote_id) {
      return res.status(400).json({ message: "quote_id is required" });
    }

    // Find admin and remove quote using $pull
    const updatedAdmin = await AdminQuote.findOneAndUpdate(
      { createdBy: userId },
      { $pull: { quotes: { quote_id } } },
      { new: true }
    );

    if (!updatedAdmin) {
      return res.status(404).json({ message: "Admin quotes not found" });
    }

    res.status(200).json({
      success: true,
      message: "Quote deleted successfully",
      remainingQuotes: updatedAdmin.quotes,
    });
  } catch (error) {
    console.error("Error deleting quote:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
