// routes/contactRoutes.js
const express = require('express');
const router = express.Router();
const { deleteAllContacts } = require('../controllers/deleteAllContactController');

router.delete('/', deleteAllContacts);

module.exports = router;
