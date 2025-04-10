const { Router } = require("express");
const {
  saveSignupData,
  processLoginData,
  googleAuth,
  appleAuth,
} = require("../controllers/userControllers");

const router = Router();

/**
 * @swagger
 * tags:
 *   name: User
 *   description: User authentication routes
 */

/**
 * @swagger
 * /user/signup:
 *   post:
 *     summary: Register a new user with email and password
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               firstname:
 *                 type: string
 *               lastname:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       409:
 *         description: User already registered
 */
router.post("/signup", saveSignupData);

/**
 * @swagger
 * /user/login:
 *   post:
 *     summary: Login a user with email and password
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: "test@test.com"
 *               password:
 *                 type: string
 *                 example: "yourpassword"
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid email or password
 */
router.post("/login", processLoginData);

/**
 * @swagger
 * /user/google-login:
 *   post:
 *     summary: Login or register using Google OAuth
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idToken
 *             properties:
 *               idToken:
 *                 type: string
 *                 description: Google ID token from frontend
 *     responses:
 *       200:
 *         description: Google login successful
 *       400:
 *         description: Google login failed
 */
router.post("/google-auth", googleAuth);

/**
 * @swagger
 * /user/apple-login:
 *   post:
 *     summary: Login or register using Apple Sign-In
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idToken
 *             properties:
 *               idToken:
 *                 type: string
 *                 description: Apple ID token from frontend
 *     responses:
 *       200:
 *         description: Apple login successful
 *       400:
 *         description: Apple login failed
 */
router.post("/apple-auth", appleAuth);

module.exports = router;
