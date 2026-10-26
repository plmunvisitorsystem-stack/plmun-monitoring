/**
 * Notifications for LGU and response team accounts (the bell in the top bar).
 * requireAuth + requireRole('response_team', 'lgu') run first, so
 * req.user = { id, role } is the staff account.
 * Each answer includes unreadCount so the client can update its badge.
 */
const StaffNotification = require('../models/staffNotification.model');

const NOT_FOUND = { code: 'NOT_FOUND', message: 'Notification not found.' };

/** GET /api/staff/notifications - my newest notifications + unread count. */
async function listMyStaffNotifications(req, res) {
  const { role, id } = req.user;
  const [notifications, unreadCount] = await Promise.all([
    StaffNotification.findByRecipient(role, id),
    StaffNotification.countUnread(role, id),
  ]);
  return res.json({ notifications, unreadCount });
}

/** PATCH /api/staff/notifications/:id/read - mark one of my notifications as Read. */
async function markOneStaffRead(req, res) {
  const notificationId = Number(req.params.id);
  if (!Number.isInteger(notificationId) || notificationId <= 0) return res.status(404).json(NOT_FOUND);

  const { role, id } = req.user;
  if (!(await StaffNotification.markRead(notificationId, role, id))) return res.status(404).json(NOT_FOUND);
  return res.json({ id: notificationId, status: 'Read', unreadCount: await StaffNotification.countUnread(role, id) });
}

/** PATCH /api/staff/notifications/read-all - mark all my notifications as Read. */
async function markAllStaffRead(req, res) {
  const updated = await StaffNotification.markAllRead(req.user.role, req.user.id);
  return res.json({ updated, unreadCount: 0 });
}

module.exports = { listMyStaffNotifications, markOneStaffRead, markAllStaffRead };
