const { Router } = require("express");
const { deleteTag } = require("../controllers/deleteTagControllers");
const router = Router();


/**
 * @swagger
 * /deleteTag:
 *   delete:
 *     summary: Delete tag
 *     tags: [Group]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tag_id:
 *                 type: string
 *                 description: The ID of the tag to delete
 *                 example: "67a20c8b9bb6ae8c8039f68e"
 *     responses:
 *       200:
 *         description: Tag deleted successfully
 */


router.delete("/", deleteTag);

module.exports = router;
