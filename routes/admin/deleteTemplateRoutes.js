const { Router } = require("express");
const { deleteTemplate } = require("../controllers/deleteTemplateController");
const router = Router();


router.delete("/", deleteTemplate);


module.exports = router;
