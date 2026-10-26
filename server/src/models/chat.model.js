/**
 * Database queries for chat_session and chat_message.
 *
 * Messages are stored in a language-neutral form (database values stay in
 * English; the screen shows them in English or Tagalog):
 *   resident clicked a menu button -> "option:<id>"    e.g. "option:myStatus"
 *   resident typed a message       -> the text as typed
 *   bot answer                     -> "intent:<id>"    e.g. "intent:myStatus",
 *                                     "intent:greeting", "intent:unknown"
 */
const { pool } = require('../config/db');

/** Starts a new chatbot conversation (status 'Bot') with the bot's greeting. Returns the session id. */
async function createBotSession(residentId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(
      "INSERT INTO chat_session (resident_id, status, date_started) VALUES (?, 'Bot', NOW())",
      [residentId],
    );
    await connection.execute(
      "INSERT INTO chat_message (session_id, sender_type, message, date_sent) VALUES (?, 'bot', 'intent:greeting', NOW())",
      [result.insertId],
    );
    await connection.commit();
    return result.insertId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/** One session, or null. */
async function findSession(sessionId) {
  const [rows] = await pool.execute(
    `SELECT session_id AS id, resident_id AS residentId, status
     FROM chat_session WHERE session_id = ?`,
    [sessionId],
  );
  return rows[0] || null;
}

/** Saves the resident's message and the bot's answer together (both or neither). */
async function saveExchange(sessionId, residentMessage, botMessage) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      "INSERT INTO chat_message (session_id, sender_type, message, date_sent) VALUES (?, 'resident', ?, NOW())",
      [sessionId, residentMessage],
    );
    await connection.execute(
      "INSERT INTO chat_message (session_id, sender_type, message, date_sent) VALUES (?, 'bot', ?, NOW())",
      [sessionId, botMessage],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { createBotSession, findSession, saveExchange };
