const {Router}= require("express")
const { getTags } = require("../controllers/getTagsControllers")
const router = Router()




/**
 * @swagger
 * /get-tag_api:
 *   get:
 *     summary: Get all tags
 *     tags: [Group]
 *     responses:
 *       200:
 *         description: Tags fetched successfully
 */


router.get("/",getTags)


module.exports = router