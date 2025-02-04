const { Router } = require("express");
const { getContact } = require("../controllers/getContactControllers");

const router = Router();


router.get("/", getContact)


module.exports = router