/**
 * Live chat (resident <-> LGU / response team staff): queue, sessions,
 * messages, and messages left outside the Chat Schedule.
 *
 * chat_session.status:  Bot -> Waiting -> Active -> Closed
 *                       Bot -> Message Left -> Closed (after a staff reply)
 *
 * Besides real messages, small "status" lines are saved as bot messages so
 * every step is in chat_message (and the queue order is exact):
 *   status:waiting          the resident asked for staff (queue order = this message's id)
 *   status:accepted         a staff member accepted (the reply countdown starts here)
 *   status:ended:resident   / status:ended:staff
 *   status:message-left     the next resident message is a message left for staff
 *   rating:1 ... rating:5   the resident's rating of the chat (optional)
 */
const { pool } = require('../config/db');
const StaffNotification = require('./staffNotification.model');

const STAFF_TABLES = {
  lgu: { table: 'lgu', id: 'lgu_id' },
  response_team: { table: 'response_team', id: 'team_id' },
};

// SQL for the staff member's display name: LGU officer, or the team name.
const STAFF_NAME_SQL = `CASE s.staff_role
  WHEN 'lgu' THEN (SELECT officer_in_charge FROM lgu WHERE lgu_id = s.staff_id)
  WHEN 'response_team' THEN (SELECT team_name FROM response_team WHERE team_id = s.staff_id)
END`;

// Helper: runs fn(connection) in a transaction (all saved, or nothing).
async function inTransaction(fn) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await fn(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function insertMessage(db, sessionId, senderType, message) {
  const [result] = await db.execute(
    'INSERT INTO chat_message (session_id, sender_type, message, date_sent) VALUES (?, ?, ?, NOW())',
    [sessionId, senderType, message],
  );
  const [[row]] = await db.execute(
    'SELECT message_id AS id, sender_type AS sender, message, date_sent AS dateSent FROM chat_message WHERE message_id = ?',
    [result.insertId],
  );
  return row;
}

// ----- Staff availability -----

async function getAvailability(role, id) {
  const { table, id: idColumn } = STAFF_TABLES[role];
  const [rows] = await pool.execute(`SELECT chat_availability AS availability FROM ${table} WHERE ${idColumn} = ?`, [id]);
  return rows[0] ? rows[0].availability : null;
}

async function setAvailability(role, id, availability) {
  const { table, id: idColumn } = STAFF_TABLES[role];
  await pool.execute(`UPDATE ${table} SET chat_availability = ? WHERE ${idColumn} = ?`, [availability, id]);
}

// ----- Sessions -----

/** One session with names and the reply countdown, or null. */
async function findSession(sessionId) {
  const [rows] = await pool.execute(
    `SELECT s.session_id AS id, s.resident_id AS residentId, r.name AS residentName, s.status,
            s.staff_role AS staffRole, s.staff_id AS staffId, ${STAFF_NAME_SQL} AS staffName,
            s.estimated_wait_minutes AS estimatedWaitMinutes,
            (SELECT TIMESTAMPDIFF(SECOND, MAX(m.date_sent), NOW()) FROM chat_message m
             WHERE m.session_id = s.session_id AND m.message = 'status:accepted') AS acceptedSecondsAgo,
            (SELECT MAX(m.message_id) FROM chat_message m
             WHERE m.session_id = s.session_id AND m.message = 'status:waiting') AS waitingMessageId,
            (SELECT COUNT(*) FROM chat_message m
             WHERE m.session_id = s.session_id AND m.message LIKE 'rating:%') AS ratings
     FROM chat_session s
     JOIN resident r ON r.resident_id = s.resident_id
     WHERE s.session_id = ?`,
    [sessionId],
  );
  return rows[0] || null;
}

/** The live part of a session: every message from "status:waiting" on. */
async function findLiveMessages(sessionId, fromMessageId) {
  const [rows] = await pool.execute(
    `SELECT message_id AS id, sender_type AS sender, message, date_sent AS dateSent
     FROM chat_message
     WHERE session_id = ? AND message_id >= ?
     ORDER BY message_id`,
    [sessionId, fromMessageId || 0],
  );
  return rows;
}

/** The resident's current Waiting or Active live chat, or null. */
async function findOpenForResident(residentId) {
  const [rows] = await pool.execute(
    `SELECT session_id AS id FROM chat_session
     WHERE resident_id = ? AND status IN ('Waiting', 'Active')
     ORDER BY session_id DESC LIMIT 1`,
    [residentId],
  );
  return rows[0] ? findSession(rows[0].id) : null;
}

/**
 * The resident asks for staff. Uses their chatbot session if it is theirs and
 * still 'Bot', otherwise starts a new session. If they already wait or chat,
 * that session is returned instead (no second place in the queue).
 */
async function requestStaff(residentId, botSessionId) {
  const sessionId = await inTransaction(async (db) => {
    // Lock the resident row: two clicks at the same moment cannot create two requests.
    await db.execute('SELECT resident_id FROM resident WHERE resident_id = ? FOR UPDATE', [residentId]);
    const [open] = await db.execute(
      "SELECT session_id FROM chat_session WHERE resident_id = ? AND status IN ('Waiting', 'Active') LIMIT 1",
      [residentId],
    );
    if (open.length > 0) return open[0].session_id;

    let id = null;
    if (Number.isInteger(botSessionId) && botSessionId > 0) {
      const [rows] = await db.execute(
        "SELECT session_id FROM chat_session WHERE session_id = ? AND resident_id = ? AND status = 'Bot' FOR UPDATE",
        [botSessionId, residentId],
      );
      if (rows.length > 0) id = rows[0].session_id;
    }
    if (id) {
      await db.execute("UPDATE chat_session SET status = 'Waiting' WHERE session_id = ?", [id]);
    } else {
      const [result] = await db.execute("INSERT INTO chat_session (resident_id, status, date_started) VALUES (?, 'Waiting', NOW())", [residentId]);
      id = result.insertId;
    }
    await insertMessage(db, id, 'bot', 'status:waiting');
    return id;
  });
  return findSession(sessionId);
}

/** Everyone waiting, first come first served: [{ id, residentId, residentName, waitingSeconds, firstMessage }]. */
async function findQueue() {
  const [rows] = await pool.query(
    `SELECT s.session_id AS id, s.resident_id AS residentId, r.name AS residentName,
            TIMESTAMPDIFF(SECOND, w.date_sent, NOW()) AS waitingSeconds,
            (SELECT m.message FROM chat_message m
             WHERE m.session_id = s.session_id AND m.sender_type = 'resident' AND m.message_id > w.message_id
             ORDER BY m.message_id LIMIT 1) AS firstMessage
     FROM chat_session s
     JOIN resident r ON r.resident_id = s.resident_id
     JOIN chat_message w ON w.message_id = (
       SELECT MAX(x.message_id) FROM chat_message x WHERE x.session_id = s.session_id AND x.message = 'status:waiting')
     WHERE s.status = 'Waiting'
     ORDER BY w.message_id`,
  );
  return rows.map((row) => ({ ...row, waitingSeconds: Number(row.waitingSeconds) }));
}

/** Active chats of one staff member. */
async function findChatsOfStaff(role, id) {
  const [rows] = await pool.execute(
    `SELECT s.session_id AS id, r.name AS residentName
     FROM chat_session s JOIN resident r ON r.resident_id = s.resident_id
     WHERE s.status = 'Active' AND s.staff_role = ? AND s.staff_id = ?
     ORDER BY s.session_id`,
    [role, id],
  );
  return rows;
}

/**
 * A staff member accepts a waiting resident. The row is locked, so if two
 * staff click "Accept" at the same moment, only the first one gets it.
 * Returns { result: 'accepted', session, message } or { result: 'not_found' | 'already_taken' }.
 */
async function accept(sessionId, staff, minutes) {
  const outcome = await inTransaction(async (db) => {
    const [rows] = await db.execute('SELECT status FROM chat_session WHERE session_id = ? FOR UPDATE', [sessionId]);
    if (rows.length === 0) return { result: 'not_found' };
    if (rows[0].status !== 'Waiting') return { result: 'already_taken' };
    await db.execute(
      "UPDATE chat_session SET status = 'Active', staff_role = ?, staff_id = ?, estimated_wait_minutes = ? WHERE session_id = ?",
      [staff.role, staff.id, minutes, sessionId],
    );
    return { result: 'accepted', message: await insertMessage(db, sessionId, 'bot', 'status:accepted') };
  });
  return outcome.result === 'accepted' ? { ...outcome, session: await findSession(sessionId) } : outcome;
}

async function addMessage(sessionId, senderType, text) {
  return insertMessage(pool, sessionId, senderType, text);
}

/** Ends a Waiting or Active chat. by: 'resident' | 'staff'. Returns false if it was not open. */
async function end(sessionId, by) {
  return inTransaction(async (db) => {
    const [rows] = await db.execute('SELECT status FROM chat_session WHERE session_id = ? FOR UPDATE', [sessionId]);
    if (rows.length === 0 || !['Waiting', 'Active'].includes(rows[0].status)) return false;
    await db.execute("UPDATE chat_session SET status = 'Closed', date_ended = NOW() WHERE session_id = ?", [sessionId]);
    await insertMessage(db, sessionId, 'bot', `status:ended:${by}`);
    return true;
  });
}

async function addRating(sessionId, rating) {
  await insertMessage(pool, sessionId, 'bot', `rating:${rating}`);
}

// ----- Messages left outside the Chat Schedule -----

/** Saves a message for staff. Uses the resident's chatbot session when possible. Returns the session id. */
async function leaveMessage(residentId, botSessionId, text) {
  return inTransaction(async (db) => {
    let id = null;
    if (Number.isInteger(botSessionId) && botSessionId > 0) {
      const [rows] = await db.execute(
        "SELECT session_id FROM chat_session WHERE session_id = ? AND resident_id = ? AND status = 'Bot' FOR UPDATE",
        [botSessionId, residentId],
      );
      if (rows.length > 0) id = rows[0].session_id;
    }
    if (id) {
      await db.execute("UPDATE chat_session SET status = 'Message Left', date_ended = NOW() WHERE session_id = ?", [id]);
    } else {
      const [result] = await db.execute(
        "INSERT INTO chat_session (resident_id, status, date_started, date_ended) VALUES (?, 'Message Left', NOW(), NOW())",
        [residentId],
      );
      id = result.insertId;
    }
    await insertMessage(db, id, 'bot', 'status:message-left');
    await insertMessage(db, id, 'resident', text);
    // Any LGU or response team account may answer it.
    await StaffNotification.notifyAllLgu(db, 'message_left', { chatSessionId: id });
    await StaffNotification.notifyAllTeams(db, 'message_left', { chatSessionId: id });
    return id;
  });
}

// Messages left (with the staff reply, if any). where: extra SQL condition.
async function findLeftMessages(where, params) {
  const [rows] = await pool.execute(
    `SELECT s.session_id AS sessionId, s.resident_id AS residentId, r.name AS residentName, s.status,
            left_msg.message AS text, left_msg.date_sent AS dateSent,
            reply.message AS replyText, reply.date_sent AS replyDate, ${STAFF_NAME_SQL} AS staffName
     FROM chat_session s
     JOIN resident r ON r.resident_id = s.resident_id
     JOIN chat_message marker ON marker.session_id = s.session_id AND marker.message = 'status:message-left'
     JOIN chat_message left_msg ON left_msg.message_id = (
       SELECT MIN(x.message_id) FROM chat_message x
       WHERE x.session_id = s.session_id AND x.sender_type = 'resident' AND x.message_id > marker.message_id)
     LEFT JOIN chat_message reply ON reply.message_id = (
       SELECT MIN(y.message_id) FROM chat_message y WHERE y.session_id = s.session_id AND y.sender_type = 'staff')
     WHERE ${where}
     ORDER BY left_msg.message_id`,
    params,
  );
  return rows;
}

/** For staff: messages left that nobody has answered yet, oldest first. */
async function findUnansweredLeftMessages() {
  return findLeftMessages("s.status = 'Message Left' AND s.staff_id IS NULL", []);
}

/** For the resident: their messages left in the last 30 days (newest 5), with replies. */
async function findLeftMessagesOfResident(residentId) {
  const rows = await findLeftMessages('s.resident_id = ? AND left_msg.date_sent >= NOW() - INTERVAL 30 DAY', [residentId]);
  return rows.slice(-5).map(({ residentId: _r, residentName: _n, status: _s, ...row }) => row);
}

/**
 * A staff member answers a message left by a resident: saves the reply,
 * closes the session, and notifies the resident - all or nothing.
 * Only the first reply counts (the row is locked).
 * Returns { result: 'replied', residentId } or { result: 'not_found' | 'already_replied' }.
 */
async function replyToLeftMessage(sessionId, staff, text, notificationText) {
  return inTransaction(async (db) => {
    const [rows] = await db.execute('SELECT resident_id, status, staff_id FROM chat_session WHERE session_id = ? FOR UPDATE', [sessionId]);
    if (rows.length === 0 || rows[0].status === 'Bot') return { result: 'not_found' };
    if (rows[0].status !== 'Message Left' || rows[0].staff_id !== null) return { result: 'already_replied' };
    await insertMessage(db, sessionId, 'staff', text);
    await db.execute(
      "UPDATE chat_session SET status = 'Closed', staff_role = ?, staff_id = ?, date_ended = NOW() WHERE session_id = ?",
      [staff.role, staff.id, sessionId],
    );
    await db.execute(
      "INSERT INTO notification (report_id, chat_session_id, message, date_sent, status) VALUES (NULL, ?, ?, NOW(), 'Unread')",
      [sessionId, notificationText],
    );
    return { result: 'replied', residentId: rows[0].resident_id };
  });
}

/** Context for staff: the resident's 5 latest reports. */
async function findResidentReports(residentId) {
  const [rows] = await pool.execute(
    `SELECT report_id AS id, issue_type AS issueType, area, status, date_submitted AS dateSubmitted, team_id AS teamId
     FROM report WHERE resident_id = ?
     ORDER BY date_submitted DESC, report_id DESC LIMIT 5`,
    [residentId],
  );
  return rows;
}

module.exports = {
  getAvailability,
  setAvailability,
  findSession,
  findLiveMessages,
  findOpenForResident,
  requestStaff,
  findQueue,
  findChatsOfStaff,
  accept,
  addMessage,
  end,
  addRating,
  leaveMessage,
  findUnansweredLeftMessages,
  findLeftMessagesOfResident,
  replyToLeftMessage,
  findResidentReports,
};
