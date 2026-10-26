/**
 * GET /api/config - public settings the forms need, from config/rules.js,
 * so the client shows the same limits the server enforces.
 */
const express = require('express');
const RULES = require('../../config/rules');

const router = express.Router();

router.get('/', (req, res) => res.json({ maxPhotos: RULES.MAX_PHOTOS, maxPhotoMb: RULES.MAX_PHOTO_MB }));

module.exports = router;
