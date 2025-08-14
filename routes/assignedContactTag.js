const { Router } = require("express");
const { assignOrUnassignTag } = require("../controllers/assignedContactTag");
const router = Router();

// Assign a tag
router.post('/', assignOrUnassignTag);

module.exports = router;
