/**
 * Hotspot routes (mounted at /api/hotspots in app.js, which requires a valid
 * token with role "response_team" or "lgu"):
 *   GET /api/hotspots - hotspot areas (team: only inside its assigned area)
 */
const express = require('express');
const { getHotspots } = require('../controllers/hotspot.controller');

const router = express.Router();

router.get('/', getHotspots);

module.exports = router;
