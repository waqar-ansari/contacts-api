const express = require('express');
const router = express.Router();
const { fetchGoogleContacts } = require('../controllers/googleContactFatchController'); // Adjust path as needed

// Fetch Google Contacts
router.get('/', fetchGoogleContacts);

module.exports = router;
