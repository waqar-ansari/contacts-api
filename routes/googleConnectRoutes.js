const express = require('express');
const router = express.Router();
const googleConnectController = require('../controllers/googleConnectController');

router.post('/google', googleConnectController.connectGoogle);
router.get('/google-callback', googleConnectController.googleCallback);
router.post('/microsoft', googleConnectController.connectMicrosoft);
router.get('/microsoft-callback', googleConnectController.microsoftCallback);


module.exports = router;
