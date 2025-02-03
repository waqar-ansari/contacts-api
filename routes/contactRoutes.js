// const {Router} = require("express");
// const { addEditContact } = require("../controllers/addEditContact");
// const router = Router()

// router.post("/",addEditContact)


// module.exports=router
const { Router } = require("express");
const { addEditContact } = require("../controllers/addEditContact");
const router = Router();

/**
 * @swagger
 * /add-edit-contact_api:
 *   post:
 *     summary: Add or update a contact
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name of the contact
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 description: Email of the contact
 *                 example: johndoe@example.com
 *               phone:
 *                 type: string
 *                 description: Phone number of the contact
 *                 example: +1234567890
 *     responses:
 *       201:
 *         description: Contact added or updated successfully
 *       400:
 *         description: Bad request or validation error
 */
router.post("/", addEditContact);

module.exports = router;
