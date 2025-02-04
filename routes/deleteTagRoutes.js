const { Router } = require("express");
const { deleteTag } = require("../controllers/deleteTagControllers");
const router = Router();

router.delete("/", deleteTag);

module.exports = router;
