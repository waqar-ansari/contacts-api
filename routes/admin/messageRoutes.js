const express = require("express");
const router = express.Router();
const {
    addMessages,
    getAllMessages,
} = require("../../controllers/admin/messageController");



// 🧑‍💼 Super Admin POST API — Add messages
router.post(
    "/add",
    addMessages
);

// 👤 All Users GET API — Get messages
router.get(
    "/get",
    getAllMessages
);

module.exports = router;
