const {Router} = require("express");
const { saveSignupData, processLoginData } = require("../controllers/userControllers");
const router = Router()


router.post("/signup",saveSignupData)
router.post("/login",processLoginData)

module.exports=router