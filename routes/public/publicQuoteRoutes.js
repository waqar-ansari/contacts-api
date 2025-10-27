const express = require("express");
const router = express.Router();
const AdminQuote = require("../../models/QuoteModel");

// 👤 All Users GET API — Get all quotes (public endpoint)
router.get("/get", async (req, res) => {
  try {
    // Fetch all admin quote documents
    const adminQuotes = await AdminQuote.find();

    // Extract all quote texts into a single flat array
    const allQuotes = adminQuotes.flatMap((doc) =>
      doc.quotes.map((q) => ({
        quote_id: q.quote_id,
        quoteText: q.quoteText,
        createdAt: q.createdAt,
      }))
    );

    // Return clean format
    res.status(200).json({
      quotes: allQuotes,
      message: "Quotes fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching quotes:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

module.exports = router;
