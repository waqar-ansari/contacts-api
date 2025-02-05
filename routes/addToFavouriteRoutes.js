const {Router} = require("express")
const { addToFavourite } = require("../controllers/addToFavouriteControllers")

const router = Router()
/**
 * @swagger
 * /addtofavourite_api:
 *   post:
 *     summary: Add or Remove from favourite
 *     tags: [Contact]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               contact_id:
 *                 type: string
 *                 description: Add or Remove from favourite
 *                 example: "67a20c8b9bb6ae8c8039f68e"
 *     responses:
 *       200:
 *         description: Contact added or removed from favourite
 */

router.post("/",addToFavourite)

module.exports =router