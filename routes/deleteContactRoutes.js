const { Router } = require("express");
const { deleteContact } = require("../controllers/deleteContactControllers");

const router = Router();

/**
 * @swagger
 * /delete-contact_api:
 *   delete:
 *     summary: Delete contact
 *     tags: [Contact]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               contact_id:
 *                 type: string
 *                 description: The ID of the contact to delete
 *                 example: "67a20c8b9bb6ae8c8039f68e"
 *     responses:
 *       200:
 *         description: Contact deleted successfully
 */

router.delete("/", deleteContact)

module.exports= router