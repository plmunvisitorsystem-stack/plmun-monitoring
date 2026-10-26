/**
 * Notification routes (mounted at /api/notifications in app.js, which
 * already requires a valid login token):
 *   PATCH /api/notifications/read-all  - mark all my notifications as Read
 *   PATCH /api/notifications/:id/read  - mark one notification as Read
 * The list itself is GET /api/resident/notifications (resident.routes.js).
 */
const express = require('express');
const { markOneRead, markAllRead } = require('../controllers/notification.controller');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

router.patch('/read-all', requireRole('resident'), markAllRead);
router.patch('/:id/read', requireRole('resident'), markOneRead);

module.exports = router;
