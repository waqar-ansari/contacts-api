const {Router} = require("express")
const { addTags } = require("../controllers/addTagsControllers")
const router = Router()

router.post("/",addTags)

module.exports =router