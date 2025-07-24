const express = require('express');
const router = express.Router();
const {
    referFriend,
    getReferredFriends
} = require('../controllers/referController');

router.post('/', referFriend);

router.get('/friends', getReferredFriends);

module.exports = router;
