const {Router} = require("express")
const { addTags } = require("../controllers/addTagsControllers")
const router = Router()


/**
 * @swagger
 * /addTag:
 *   post:
 *     summary: Add tag to user
 *     tags: [Group]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tag:
 *                 type: string
 *                 description: Add tag
 *                 example: "exampleTag"
 *     responses:
 *       200:
 *         description: Tag added successfully
 */



router.post("/",addTags)

module.exports =router