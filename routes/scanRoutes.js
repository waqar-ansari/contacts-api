const express = require("express");
const router = express.Router();
const { scanUser, getScanData } = require("../controllers/scanController");

/**
 * @swagger
 * /api/scan:
 *   post:
 *     summary: Scan a user using their QR code
 *     tags: [Scan]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ScannerID:
 *                 type: string
 *                 example: 67ef95cc9da0a004d4691015
 *               UserID:
 *                 type: string
 *                 example: 67ffbebad9d8d9a32c8b9c5d
 *     responses:
 *       200:
 *         description: Scan successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 iScanned:
 *                   type: array
 *                   items:
 *                     type: string
 *                 scannedMe:
 *                   type: array
 *                   items:
 *                     type: string
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.post("/", scanUser); // POST /api/scan

/**
 * @swagger
 * /api/scan/get_data:
 *   get:
 *     summary: Get all scan data of logged-in user
 *     tags: [Scan]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Scan data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 iScanned:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *                 scannedMe:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.get("/get_data", getScanData); // GET /api/scan/get_data

module.exports = router;
