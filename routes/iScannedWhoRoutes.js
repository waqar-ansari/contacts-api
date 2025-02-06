const {Router} = require("express")
const { iScannedWho } = require("../controllers/iScannedWhoControllers")

const router = Router()

router.post("/", iScannedWho)

module.exports = router