const { Router } = require("express")
const { addEditTag } = require("../controllers/addEditTagControllers")
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



router.post("/", addEditTag)

module.exports = router