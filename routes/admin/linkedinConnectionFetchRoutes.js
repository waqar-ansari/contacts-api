const express = require('express');
const router = express.Router();

const {
    redirectToLinkedIn, handleLinkedinCallback
} = require('../controllers/linkedinConnectionFetchController');

// Step 1: Trigger Google OAuth
router.get('/', redirectToLinkedIn);

// Step 2: Handle redirect and return contacts
router.get('/linkedin/callback', handleLinkedinCallback);

module.exports = router;
