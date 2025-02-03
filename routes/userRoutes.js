// const {Router} = require("express");
// const { saveSignupData, processLoginData } = require("../controllers/userControllers");
// const router = Router()


// router.post("/signup",saveSignupData)
// router.post("/login",processLoginData)

// module.exports=router


const { Router } = require("express");
const { saveSignupData, processLoginData } = require("../controllers/userControllers");
const router = Router();

/**
 * @swagger
 * /user/signup:
 *   post:
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 */
router.post("/signup", saveSignupData);

/**
 * @swagger
 * /user/login:
 *   post:
 *     summary: User login
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 */
router.post("/login", processLoginData);

module.exports = router;
