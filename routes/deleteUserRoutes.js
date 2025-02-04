const {Router} = require("express")
const { deleteUser } = require("../controllers/deleteUserControllers")
const router = Router()

router.delete("/",deleteUser)


module.exports = router