const express = require('express');
const router = express.Router();
const accountConnectController = require('../../controllers/admin/accountConnectController');

router.post('/google', accountConnectController.connectGoogle);
router.get('/google-callback', accountConnectController.googleCallback);
router.post('/microsoft', accountConnectController.connectMicrosoft);
router.get('/microsoft-callback', accountConnectController.microsoftCallback);
router.post('/smtp', accountConnectController.connectSMTP);

module.exports = router;
