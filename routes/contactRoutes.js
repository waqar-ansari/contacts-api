const { Router } = require("express");
const { addEditContact } = require("../controllers/addEditContact");
const router = Router();

/**
 * @swagger
 * /add-edit-contact_api:
 *   post:
 *     tags: [Contact]
 *     summary: Add or update contact
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               contact_id:
 *                 type: string
 *                 description: Name of the contact
 *                 example: "0"
 *               firstname:
 *                 type: string
 *                 description: Firstname of the contact
 *                 example: fname
 *               lastname:
 *                 type: string
 *                 description: Lastname of the contact
 *                 example: lname
 *               emailaddresses:
 *                 type: string
 *                 description: Email of the contact
 *                 example: test@test.com
 *               isFavourite:
 *                 type: boolean
 *                 description: Email of the contact
 *                 example: false
 *               phonenumbers:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       countryCode:
 *                         type: string
 *                       number:
 *                         type: string
 *               tags:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       tag:
 *                         type: string
 *     responses:
 *       201:
 *         description: Contact added or updated successfully
 */
router.post("/", addEditContact);

module.exports = router;
