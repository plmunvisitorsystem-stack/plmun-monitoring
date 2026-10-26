/**
 * Dashboard routes (mounted at /api/dashboard in app.js, which requires a
 * valid token with role "response_team" or "lgu"):
 *   GET /api/dashboard/summary
 */
const express = require('express');
const { getSummary } = require('../controllers/dashboard.controller');

const router = express.Router();

router.get('/summary', getSummary);

module.exports = router;
