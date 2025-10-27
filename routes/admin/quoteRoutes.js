const express = require("express");
const router = express.Router();
const {
  addQuotes,
  getAllQuotes,
} = require("../../controllers/admin/quoteController");

// 🧑‍💼 Super Admin POST API — Add quotes
router.post("/add", addQuotes);

// 👤 All Users GET API — Get quotes
router.get("/get", getAllQuotes);

module.exports = router;
