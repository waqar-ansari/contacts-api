const {Router} = require("express");
const { editProfile } = require("../controllers/editProfile");
const router = Router()

router.put("/",editProfile)


module.exports=router