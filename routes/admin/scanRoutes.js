const express = require("express");
const router = express.Router();
const { scanUser } = require("../controllers/scanController");

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

module.exports = router;
