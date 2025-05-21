const { Router } = require("express");
const { deleteTask } = require("../controllers/deleteTaskController");
const router = Router();

router.delete("/", deleteTask);

module.exports = router;