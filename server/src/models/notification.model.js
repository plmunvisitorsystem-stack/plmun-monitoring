/**
 * Database queries for the notification table.
 * A notification belongs to a report OR to a live chat session; the
 * resident who owns that report (report.resident_id) or chat
 * (chat_session.resident_id) is the one who receives it.
 */
const { pool } = require('../config/db');

/** All notifications for one resident's reports, newest first. */
async function findByResident(residentId) {
  const [rows] = await pool.execute(
    `SELECT n.notification_id AS id, n.report_id AS reportId, n.chat_session_id AS chatSessionId,
            r.date_submitted AS reportDateSubmitted,
            n.message, n.date_sent AS dateSent, n.status
     FROM notification n
     LEFT JOIN report r ON r.report_id = n.report_id
     LEFT JOIN chat_session c ON c.session_id = n.chat_session_id
     WHERE COALESCE(r.resident_id, c.resident_id) = ?
     ORDER BY n.date_sent DESC, n.notification_id DESC`,
    [residentId],
  );
  return rows;
}

/** How many of the resident's notifications are still Unread. */
async function countUnread(residentId) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS total
     FROM notification n
     LEFT JOIN report r ON r.report_id = n.report_id
     LEFT JOIN chat_session c ON c.session_id = n.chat_session_id
     WHERE COALESCE(r.resident_id, c.resident_id) = ? AND n.status = 'Unread'`,
    [residentId],
  );
  return Number(rows[0].total);
}

/** One notification with the id of the resident who owns it, or null. */
async function findWithOwner(notificationId) {
  const [rows] = await pool.execute(
    `SELECT n.notification_id AS id, n.status, COALESCE(r.resident_id, c.resident_id) AS residentId
     FROM notification n
     LEFT JOIN report r ON r.report_id = n.report_id
     LEFT JOIN chat_session c ON c.session_id = n.chat_session_id
     WHERE n.notification_id = ?`,
    [notificationId],
  );
  return rows[0] || null;
}

async function markRead(notificationId) {
  await pool.execute("UPDATE notification SET status = 'Read' WHERE notification_id = ?", [notificationId]);
}

/** Marks all of the resident's Unread notifications as Read. Returns how many changed. */
async function markAllRead(residentId) {
  const [result] = await pool.execute(
    `UPDATE notification n
     LEFT JOIN report r ON r.report_id = n.report_id
     LEFT JOIN chat_session c ON c.session_id = n.chat_session_id
     SET n.status = 'Read'
     WHERE COALESCE(r.resident_id, c.resident_id) = ? AND n.status = 'Unread'`,
    [residentId],
  );
  return result.affectedRows;
}

module.exports = { findByResident, countUnread, findWithOwner, markRead, markAllRead };
