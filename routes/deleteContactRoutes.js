const { Router } = require("express");
const { deleteContact } = require("../controllers/deleteContactControllers");

const router = Router();


router.delete("/", deleteContact)

module.exports= router