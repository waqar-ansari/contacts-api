const express = require('express');
const router = express.Router();
const { sendEmail, sendEmailMicrosoft, sendEmailSMTP } = require('../controllers/sendEmailController');

router.post('/google', sendEmail);

router.post('/microsoft', sendEmailMicrosoft);

router.post('/smtp', sendEmailSMTP);


module.exports = router;
