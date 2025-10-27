const express = require("express");
const router = express.Router();
const {
  addQuotes,
  getAllQuotes,
  editQuote,
  deleteQuote,
} = require("../../controllers/admin/quoteController");

// 🧑‍💼 Super Admin POST API — Add quotes
router.post("/add", addQuotes);

// 👤 All Users GET API — Get quotes
router.get("/get", getAllQuotes);

// 🧑‍💼 Super Admin PUT API — Edit a quote
router.put("/edit", editQuote);

// 🧑‍💼 Super Admin DELETE API — Delete a quote
router.delete("/delete", deleteQuote);

module.exports = router;
