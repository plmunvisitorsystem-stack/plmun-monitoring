/**
 * Notifications for residents.
 * requireAuth + requireRole('resident') run first, so req.user.id is the resident.
 * Each answer includes unreadCount so the client can update its badge.
 */
const Notification = require('../models/notification.model');

/** GET /api/resident/notifications - my notifications, newest first. */
async function listMyNotifications(req, res) {
  const notifications = await Notification.findByResident(req.user.id);
  const unreadCount = notifications.filter((item) => item.status === 'Unread').length;
  return res.json({ notifications, unreadCount });
}

/** PATCH /api/notifications/:id/read - mark one of my notifications as Read. */
async function markOneRead(req, res) {
  const notificationId = Number(req.params.id);
  if (!Number.isInteger(notificationId) || notificationId <= 0) {
    return res.status(404).json({ code: 'NOT_FOUND', message: 'Notification not found.' });
  }

  const notification = await Notification.findWithOwner(notificationId);
  if (!notification) {
    return res.status(404).json({ code: 'NOT_FOUND', message: 'Notification not found.' });
  }
  if (notification.residentId !== req.user.id) {
    return res.status(403).json({ code: 'FORBIDDEN', message: 'This is not your notification.' });
  }

  if (notification.status !== 'Read') {
    await Notification.markRead(notificationId);
  }
  const unreadCount = await Notification.countUnread(req.user.id);
  return res.json({ id: notificationId, status: 'Read', unreadCount });
}

/** PATCH /api/notifications/read-all - mark all my notifications as Read. */
async function markAllRead(req, res) {
  const updated = await Notification.markAllRead(req.user.id);
  return res.json({ updated, unreadCount: 0 });
}

module.exports = { listMyNotifications, markOneRead, markAllRead };
