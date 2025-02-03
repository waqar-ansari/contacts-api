const {Router} = require("express");
const { addEditContact } = require("../controllers/addEditContact");
const router = Router()

router.post("/",addEditContact)


module.exports=router