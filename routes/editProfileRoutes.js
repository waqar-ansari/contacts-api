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
 *     summary: Update user profile information
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Bad request or validation error
 */
router.put("/", editProfile);

module.exports = router;
