const {Router}= require("express")
const { getTags } = require("../controllers/getTagsControllers")
const router = Router()

router.get("/",getTags)


module.exports = router