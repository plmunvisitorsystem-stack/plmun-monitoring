/**
 * Database queries for the staff_notification table (the bell for LGU and
 * response team accounts). One row per recipient account.
 * The text is not stored: the client builds it in English or Tagalog from
 * type + report + detail.
 *   new_report      -> every LGU account
 *   assigned        -> the response team the report was assigned to
 *   status_changed  -> every LGU account (detail = the new status)
 *   message_left    -> every LGU and response team account
 * The notify* helpers take the transaction connection (db) so the
 * notification is saved together with the change, or not at all.
 */
const { pool } = require('../config/db');

const LIST_LIMIT = 30; // the bell shows the newest 30

async function notifyAllLgu(db, type, { reportId = null, chatSessionId = null, detail = null } = {}) {
  await db.execute(
    `INSERT INTO staff_notification (recipient_role, recipient_id, type, report_id, chat_session_id, detail, date_sent, status)
     SELECT 'lgu', lgu_id, ?, ?, ?, ?, NOW(), 'Unread' FROM lgu`,
    [type, reportId, chatSessionId, detail],
  );
}

async function notifyAllTeams(db, type, { reportId = null, chatSessionId = null, detail = null } = {}) {
  await db.execute(
    `INSERT INTO staff_notification (recipient_role, recipient_id, type, report_id, chat_session_id, detail, date_sent, status)
     SELECT 'response_team', team_id, ?, ?, ?, ?, NOW(), 'Unread' FROM response_team`,
    [type, reportId, chatSessionId, detail],
  );
}

async function notifyTeam(db, teamId, type, { reportId = null, detail = null } = {}) {
  await db.execute(
    `INSERT INTO staff_notification (recipient_role, recipient_id, type, report_id, detail, date_sent, status)
     VALUES ('response_team', ?, ?, ?, ?, NOW(), 'Unread')`,
    [teamId, type, reportId, detail],
  );
}

/** The newest notifications of one staff account, with the report's id data for "#YYYY-####". */
async function findByRecipient(role, id) {
  const [rows] = await pool.execute(
    `SELECT n.staff_notification_id AS id, n.type, n.report_id AS reportId, n.chat_session_id AS chatSessionId,
            r.date_submitted AS reportDateSubmitted, r.issue_type AS issueType,
            n.detail, n.date_sent AS dateSent, n.status
     FROM staff_notification n
     LEFT JOIN report r ON r.report_id = n.report_id
     WHERE n.recipient_role = ? AND n.recipient_id = ?
     ORDER BY n.date_sent DESC, n.staff_notification_id DESC
     LIMIT ${LIST_LIMIT}`,
    [role, id],
  );
  return rows;
}

async function countUnread(role, id) {
  const [rows] = await pool.execute(
    "SELECT COUNT(*) AS total FROM staff_notification WHERE recipient_role = ? AND recipient_id = ? AND status = 'Unread'",
    [role, id],
  );
  return Number(rows[0].total);
}

/** Marks one notification Read if it belongs to this account. Returns false if not found / not theirs. */
async function markRead(notificationId, role, id) {
  const [rows] = await pool.execute(
    'SELECT staff_notification_id FROM staff_notification WHERE staff_notification_id = ? AND recipient_role = ? AND recipient_id = ?',
    [notificationId, role, id],
  );
  if (rows.length === 0) return false;
  await pool.execute("UPDATE staff_notification SET status = 'Read' WHERE staff_notification_id = ?", [notificationId]);
  return true;
}

async function markAllRead(role, id) {
  const [result] = await pool.execute(
    "UPDATE staff_notification SET status = 'Read' WHERE recipient_role = ? AND recipient_id = ? AND status = 'Unread'",
    [role, id],
  );
  return result.affectedRows;
}

module.exports = { notifyAllLgu, notifyAllTeams, notifyTeam, findByRecipient, countUnread, markRead, markAllRead };
