const {Router} = require("express")
const { addToFavourite } = require("../controllers/addToFavouriteControllers")

const router = Router()

router.post("/",addToFavourite)

module.exports =router