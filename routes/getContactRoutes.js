const { Router } = require("express");
const { getContact } = require("../controllers/getContactControllers");

const router = Router();

/**
 * @swagger
 * /get-contact_api:
 *   get:
 *     summary: Get contact details
 *     tags: [User]
 *     responses:
 *       200:
 *         description: Contact details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 contact_id:
 *                   type: string
 *                   description: The ID of the contact
 *                 firstname:
 *                   type: string
 *                   description: The first name of the contact
 *                 lastname:
 *                   type: string
 *                   description: The last name of the contact
 *                 email:
 *                   type: string
 *                   description: The email address of the contact
 *                 phonenumbers:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       countryCode:
 *                         type: string
 *                       number:
 *                         type: string
 *       500:
 *         description: Error fetching contact details
 */
router.get("/", getContact);

module.exports = router;
