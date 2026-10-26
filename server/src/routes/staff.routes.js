/**
 * Routes shared by LGU and response team accounts (mounted at /api/staff in
 * app.js, which requires a valid token with role "lgu" or "response_team"):
 *   GET   /api/staff/notifications           - my newest 30 notifications + unreadCount
 *   PATCH /api/staff/notifications/read-all  - mark all my notifications as Read
 *   PATCH /api/staff/notifications/:id/read  - mark one notification as Read
 */
const express = require('express');
const {
  listMyStaffNotifications,
  markOneStaffRead,
  markAllStaffRead,
} = require('../controllers/staffNotification.controller');

const router = express.Router();

router.get('/notifications', listMyStaffNotifications);
router.patch('/notifications/read-all', markAllStaffRead); // must come before /:id/read
router.patch('/notifications/:id/read', markOneStaffRead);

module.exports = router;
