/**
 * GET /api/areas - the list of areas (puroks) from config/areas.js.
 * Public: it holds no private data and is needed by forms before login data loads.
 */
const express = require('express');
const AREAS = require('../../config/areas');

const router = express.Router();

router.get('/', (req, res) => res.json({ areas: AREAS }));

module.exports = router;
