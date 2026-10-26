/**
 * Resident routes (mounted at /api/resident in app.js, which already
 * requires a valid token with role "resident"):
 *   GET /api/resident/reports        - my reports, newest first
 *   GET /api/resident/notifications  - my notifications, newest first
 */
const express = require('express');
const { listMyReports } = require('../controllers/resident.controller');
const { listMyNotifications } = require('../controllers/notification.controller');

const router = express.Router();

router.get('/reports', listMyReports);
router.get('/notifications', listMyNotifications);

module.exports = router;
