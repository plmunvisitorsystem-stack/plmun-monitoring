/**
 * Database queries for the feedback table.
 */
const { pool } = require('../config/db');

/**
 * Saves feedback for a report, but only once per report.
 * Runs in a transaction that locks the report row, so two requests at the
 * same moment cannot both save feedback (the second one waits, then sees
 * the first one's feedback).
 *
 * Returns:
 *   { result: 'saved', feedback }  - saved
 *   { result: 'not_found' }        - report does not exist
 *   { result: 'not_owner' }        - report belongs to another resident
 *   { result: 'not_resolved' }     - report is not Resolved yet
 *   { result: 'exists' }           - feedback was already given
 */
async function createOnce(residentId, reportId, { rating, comments }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [reports] = await connection.execute(
      'SELECT resident_id AS residentId, status FROM report WHERE report_id = ? FOR UPDATE',
      [reportId],
    );

    let problem = null;
    if (reports.length === 0) problem = 'not_found';
    else if (reports[0].residentId !== residentId) problem = 'not_owner';
    else if (reports[0].status !== 'Resolved') problem = 'not_resolved';
    else {
      const [existing] = await connection.execute('SELECT 1 FROM feedback WHERE report_id = ? LIMIT 1', [reportId]);
      if (existing.length > 0) problem = 'exists';
    }

    if (problem) {
      await connection.rollback();
      return { result: problem };
    }

    const [insert] = await connection.execute(
      `INSERT INTO feedback (resident_id, report_id, comments, rating, date_submitted)
       VALUES (?, ?, ?, ?, NOW())`,
      [residentId, reportId, comments, rating],
    );
    const [rows] = await connection.execute(
      `SELECT feedback_id AS id, rating, comments, date_submitted AS dateSubmitted
       FROM feedback WHERE feedback_id = ?`,
      [insert.insertId],
    );

    await connection.commit();
    return { result: 'saved', feedback: rows[0] };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { createOnce };
