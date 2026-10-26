/**
 * Help and Support routes (mounted at /api/chat in app.js, which requires a
 * valid login token; every role may use them):
 *   GET /api/chat/status - is live chat open now, today's hours, next opening, available staff
 */
const express = require('express');
const { getStatus } = require('../controllers/chat.controller');

const router = express.Router();

router.get('/status', getStatus);

module.exports = router;
