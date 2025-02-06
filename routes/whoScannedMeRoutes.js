const {Router} = require("express")
const { whoScannedMe } = require("../controllers/whoScannedMeControllers")

const router = Router()

router.post("/", whoScannedMe)

module.exports = router