/**
 * Profile routes for every role (mounted at /api/profile in app.js,
 * which requires a valid login token):
 *   GET /api/profile           - my profile
 *   PUT /api/profile           - save my profile fields
 *   PUT /api/profile/password  - change my password (needs the current one)
 */
const express = require('express');
const { getProfile, updateProfile, changePassword } = require('../controllers/profile.controller');

const router = express.Router();

router.get('/', getProfile);
router.put('/', updateProfile);
router.put('/password', changePassword);

module.exports = router;
