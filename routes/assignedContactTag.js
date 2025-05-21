const { Router } = require("express");
const { assignTagToContact, unassignTagFromContact } = require("../controllers/assignedContactTag");
const router = Router();

// Assign a tag
router.post('/assign-tag', assignTagToContact);

// Unassign a tag
router.post('/unassign-tag', unassignTagFromContact);

module.exports = router;
