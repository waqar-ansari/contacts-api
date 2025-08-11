const { Router } = require("express")
const { getTagWithContact } = require("../controllers/getTagWithContactController")
const router = Router()




/**
 * @swagger
 * /getTag:
 *   get:
 *     summary: Get all tags
 *     tags: [Group]
 *     responses:
 *       200:
 *         description: Tags fetched successfully
 */


router.get("/", getTagWithContact)


module.exports = router