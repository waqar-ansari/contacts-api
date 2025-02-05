const {Router} = require("express")
const { deleteUser } = require("../controllers/deleteUserControllers")
const router = Router()

/**
 * @swagger
 * /delete-user_api:
 *   delete:
 *     summary: Delete user account
 *     tags: [User]
 *     responses:
 *       200:
 *         description: User deleted successfully
 */


router.delete("/",deleteUser)


module.exports = router