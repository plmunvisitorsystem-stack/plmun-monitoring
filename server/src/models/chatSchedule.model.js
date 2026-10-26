/**
 * Database queries for the chat_schedule table (LGU Chat Schedule page).
 * Weekly rows: day_of_week 1-7, specific_date NULL. Special rows: specific_date set.
 * How the rows decide "open now" is in services/chatSchedule.js.
 */
const { pool } = require('../config/db');

const hhmm = (time) => String(time).slice(0, 5); // '08:00:00' -> '08:00'
// A day with no weekly row is closed; it is shown with the default hours.
const DEFAULT_HOURS = { isOpen: false, start: '08:00', end: '17:00' };

/** The 7 weekdays (Monday first), each { dayOfWeek, isOpen, start, end }. */
async function findWeekly() {
  const [rows] = await pool.execute(
    `SELECT day_of_week AS dayOfWeek, start_time AS startTime, end_time AS endTime, is_open AS isOpen
     FROM chat_schedule WHERE specific_date IS NULL`,
  );
  return [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => {
    const row = rows.find((item) => Number(item.dayOfWeek) === dayOfWeek);
    return row
      ? { dayOfWeek, isOpen: Boolean(Number(row.isOpen)), start: hhmm(row.startTime), end: hhmm(row.endTime) }
      : { dayOfWeek, ...DEFAULT_HOURS };
  });
}

/** Special dates from today on (Manila date), soonest first. */
async function findSpecialFrom(today) {
  const [rows] = await pool.execute(
    `SELECT schedule_id AS id, DATE_FORMAT(specific_date, '%Y-%m-%d') AS date,
            start_time AS startTime, end_time AS endTime, is_open AS isOpen
     FROM chat_schedule
     WHERE specific_date IS NOT NULL AND specific_date >= ?
     ORDER BY specific_date`,
    [today],
  );
  return rows.map((row) => ({
    id: row.id,
    date: row.date,
    isOpen: Boolean(Number(row.isOpen)),
    start: hhmm(row.startTime),
    end: hhmm(row.endTime),
  }));
}

/** Saves all 7 weekdays in one transaction (one row per weekday). */
async function saveWeekly(lguId, days) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const day of days) {
      await connection.execute(
        `INSERT INTO chat_schedule (lgu_id, day_of_week, specific_date, start_time, end_time, is_open)
         VALUES (?, ?, NULL, ?, ?, ?)
         ON DUPLICATE KEY UPDATE lgu_id = VALUES(lgu_id), start_time = VALUES(start_time),
                                 end_time = VALUES(end_time), is_open = VALUES(is_open)`,
        [lguId, day.dayOfWeek, day.start, day.end, day.isOpen ? 1 : 0],
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/** Adds a special date, or replaces the one already set for that date. */
async function saveSpecial(lguId, { date, isOpen, start, end }) {
  await pool.execute(
    `INSERT INTO chat_schedule (lgu_id, day_of_week, specific_date, start_time, end_time, is_open)
     VALUES (?, NULL, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE lgu_id = VALUES(lgu_id), start_time = VALUES(start_time),
                             end_time = VALUES(end_time), is_open = VALUES(is_open)`,
    [lguId, date, start, end, isOpen ? 1 : 0],
  );
}

/** Removes a special date. Returns false if there was no such special date. */
async function removeSpecial(scheduleId) {
  const [result] = await pool.execute(
    'DELETE FROM chat_schedule WHERE schedule_id = ? AND specific_date IS NOT NULL',
    [scheduleId],
  );
  return result.affectedRows > 0;
}

module.exports = { findWeekly, findSpecialFrom, saveWeekly, saveSpecial, removeSpecial };
