/**
 * Database queries for report photos (table report_photo).
 */
const { pool } = require('../config/db');

/** Photos of one report, oldest first: [{ id, dateUploaded }] (never the file path). */
async function findByReport(reportId) {
  const [rows] = await pool.execute(
    `SELECT photo_id AS id, date_uploaded AS dateUploaded
     FROM report_photo WHERE report_id = ? ORDER BY photo_id`,
    [reportId],
  );
  return rows;
}

/** One photo with the report's owner and team (to check who may see it), or null. */
async function findWithReport(photoId) {
  const [rows] = await pool.execute(
    `SELECT p.photo_id AS id, p.file_path AS filePath,
            r.resident_id AS residentId, r.team_id AS teamId
     FROM report_photo p
     JOIN report r ON r.report_id = p.report_id
     WHERE p.photo_id = ?`,
    [photoId],
  );
  return rows[0] || null;
}

module.exports = { findByReport, findWithReport };
