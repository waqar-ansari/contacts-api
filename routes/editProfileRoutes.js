// const {Router} = require("express");
// const { editProfile } = require("../controllers/editProfile");
// const router = Router()

// router.put("/",editProfile)


// module.exports=router
const { Router } = require("express");
const { editProfile } = require("../controllers/editProfile");
const router = Router();

/**
 * @swagger
 * /edit-profile_api:
 *   put:
 *     summary: Update user profile
 *     tags: [User]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstname:
 *                 type: string
 *               lastname:
 *                 type: string
 *               email:
 *                 type: string
 *               phonenumbers:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       countryCode:
 *                         type: string
 *                       number:
 *                         type: string
 *               profileImageURL:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
router.put("/", editProfile);

module.exports = router;
