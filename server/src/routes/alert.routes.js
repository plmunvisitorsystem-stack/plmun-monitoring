/**
 * Alert routes (mounted at /api/alerts in app.js, which requires a valid
 * token with role "response_team" or "lgu"):
 *   GET /api/alerts/overdue - overdue reports (team: only its own)
 */
const express = require('express');
const { getOverdue } = require('../controllers/alert.controller');

const router = express.Router();

router.get('/overdue', getOverdue);

module.exports = router;
