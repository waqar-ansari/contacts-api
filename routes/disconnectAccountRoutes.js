const express = require('express');
const router = express.Router();


const disconnectAccountControllers = require('../controllers/disconnectAccountControllers');

router.post('/google', disconnectAccountControllers.disconnectGoogle);

module.exports = router;
