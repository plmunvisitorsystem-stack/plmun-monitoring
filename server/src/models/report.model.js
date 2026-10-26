/**
 * Database queries for the report table.
 * All queries use "?" placeholders (parameterized) to prevent SQL injection.
 *
 * Status flow (v2):
 *   Submitted --(LGU assigns a team)--> Under Review --(team)--> In Progress --(team)--> Resolved
 */
const { pool } = require('../config/db');
const PhotoStorage = require('../config/photoStorage');
const { STATUS_MESSAGES, statusChangeMessage, assignedMessage } = require('../utils/notificationMessages');
const { formatReportId } = require('../utils/format');
const SmartRules = require('../../services/smartRules');
const StaffNotification = require('./staffNotification.model');

/** All reports of one resident, newest first. */
async function findByResident(residentId) {
  const [rows] = await pool.execute(
    `SELECT report_id AS id, issue_type AS issueType, area, location, description,
            date_submitted AS dateSubmitted, status, ${SmartRules.overdueSql()} AS isOverdue
     FROM report
     WHERE resident_id = ?
     ORDER BY date_submitted DESC, report_id DESC`,
    [residentId],
  );
  return rows.map(SmartRules.withOverdueFlag);
}

/**
 * One report by id, or null if it does not exist.
 * Includes residentId (to check the owner), hasFeedback, and the
 * feedback itself ({ rating, comments, dateSubmitted } or null).
 */
async function findById(reportId) {
  const [rows] = await pool.execute(
    `SELECT r.report_id AS id, r.resident_id AS residentId, r.issue_type AS issueType, r.area,
            r.location, r.description, r.date_submitted AS dateSubmitted, r.status,
            r.resolution_notes AS resolutionNotes, ${SmartRules.overdueSql('r')} AS isOverdue,
            f.rating AS feedbackRating, f.comments AS feedbackComments,
            f.date_submitted AS feedbackDate
     FROM report r
     LEFT JOIN feedback f ON f.report_id = r.report_id
     WHERE r.report_id = ?
     ORDER BY f.feedback_id
     LIMIT 1`,
    [reportId],
  );
  if (rows.length === 0) return null;

  const { feedbackRating, feedbackComments, feedbackDate, ...report } = SmartRules.withOverdueFlag(rows[0]);
  const hasFeedback = feedbackRating !== null;
  return {
    ...report,
    hasFeedback,
    feedback: hasFeedback ? { rating: feedbackRating, comments: feedbackComments, dateSubmitted: feedbackDate } : null,
  };
}

// If the same resident sends the exact same report again within this many
// seconds (e.g. a double-click), we return the first one instead of saving twice.
const DUPLICATE_WINDOW_SECONDS = 60;

const NEW_REPORT_COLUMNS = `report_id AS id, issue_type AS issueType, area, priority,
       similar_to_report_id AS similarToReportId, location, description,
       date_submitted AS dateSubmitted, status, ${SmartRules.overdueSql()} AS isOverdue`;

/**
 * Saves a new report (status "Submitted", date = now), its photos, and its
 * "submitted" notification in ONE transaction: all are saved, or nothing.
 * Priority and the similar-report link are set by the smart rules
 * (services/smartRules.js); a 3rd matching report can also raise the
 * priority of earlier unresolved reports.
 *   photos: files from the uploadPhotos middleware (already type-checked)
 *
 * Returns { report, duplicate } where duplicate is true when an identical
 * report was just sent and that existing report is returned instead.
 */
async function createWithNotification(residentId, { issueType, area, location, description }, photos = []) {
  const connection = await pool.getConnection();
  const writtenFiles = []; // deleted again if anything fails
  try {
    await connection.beginTransaction();

    // Lock this resident's row until COMMIT. If two requests arrive at the
    // same moment, the second waits here, then finds the first as a duplicate.
    await connection.execute('SELECT resident_id FROM resident WHERE resident_id = ? FOR UPDATE', [residentId]);

    const [existing] = await connection.execute(
      `SELECT ${NEW_REPORT_COLUMNS}
       FROM report
       WHERE resident_id = ? AND issue_type = ? AND area = ? AND location = ? AND description = ?
         AND date_submitted >= NOW() - INTERVAL ${DUPLICATE_WINDOW_SECONDS} SECOND
       ORDER BY report_id DESC
       LIMIT 1`,
      [residentId, issueType, area, location, description],
    );
    if (existing.length > 0) {
      await connection.commit();
      return { report: SmartRules.withOverdueFlag(existing[0]), duplicate: true };
    }

    // Similar report: looked up BEFORE saving, so the new report never matches itself.
    const similar = await SmartRules.findSimilarReport(connection, { issueType, area });

    const [result] = await connection.execute(
      `INSERT INTO report (resident_id, issue_type, area, priority, similar_to_report_id,
                           location, description, date_submitted, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), 'Submitted')`,
      [residentId, issueType, area, SmartRules.getBasePriority(issueType), similar ? similar.id : null, location, description],
    );
    const reportId = result.insertId;

    // Priority: counts the new report too, so it runs AFTER the insert.
    await SmartRules.applyPriorityRules(connection, { reportId, issueType, area });

    // Photos: random file names (never the name from the user's phone),
    // on the server disk or in Cloudinary (config/photoStorage.js).
    for (const photo of photos) {
      const storedPath = await PhotoStorage.savePhoto('reports', photo.buffer, photo.detected.ext);
      writtenFiles.push(storedPath);
      await connection.execute(
        'INSERT INTO report_photo (report_id, file_path, date_uploaded) VALUES (?, ?, NOW())',
        [reportId, storedPath],
      );
    }

    await connection.execute(
      `INSERT INTO notification (report_id, message, date_sent, status)
       VALUES (?, ?, NOW(), 'Unread')`,
      [reportId, STATUS_MESSAGES.Submitted],
    );
    await StaffNotification.notifyAllLgu(connection, 'new_report', { reportId });

    const [rows] = await connection.execute(`SELECT ${NEW_REPORT_COLUMNS} FROM report WHERE report_id = ?`, [reportId]);

    await connection.commit();
    return { report: { ...SmartRules.withOverdueFlag(rows[0]), photoCount: writtenFiles.length }, duplicate: false };
  } catch (error) {
    await connection.rollback();
    // Remove photos that were saved before the error.
    await Promise.all(writtenFiles.map((storedPath) => PhotoStorage.deletePhoto(storedPath)));
    throw error;
  } finally {
    // Always give the connection back to the pool.
    connection.release();
  }
}

const TEAM_PAGE_SIZE = 10;

/**
 * Reports assigned to this response team (and only those).
 *   filters: { issueType, status, overdue, dateFrom, dateTo, search: { id, year, text }, page }
 * Returns { reports, total, page, pageSize, totalPages }.
 */
async function findForTeam(teamId, filters) {
  const where = ['r.team_id = ?'];
  const params = [teamId];

  if (filters.issueType) {
    where.push('r.issue_type = ?');
    params.push(filters.issueType);
  }
  if (filters.status) {
    where.push('r.status = ?');
    params.push(filters.status);
  }
  if (filters.overdue) where.push(SmartRules.overdueSql('r'));
  if (filters.dateFrom) {
    where.push('r.date_submitted >= ?');
    params.push(`${filters.dateFrom} 00:00:00`);
  }
  if (filters.dateTo) {
    // "To" includes the whole day: before midnight of the next day.
    where.push('r.date_submitted < DATE_ADD(?, INTERVAL 1 DAY)');
    params.push(filters.dateTo);
  }
  if (filters.search) {
    // Match the report ID (e.g. #2026-0013 or 13) OR part of the location.
    // Escape % and _ so they are searched as normal characters, not wildcards.
    const likeText = filters.search.text.replace(/[\\%_]/g, '\\$&');
    const conditions = ['r.location LIKE ?'];
    params.push(`%${likeText}%`);
    if (filters.search.id) {
      conditions.push(filters.search.year ? '(r.report_id = ? AND YEAR(r.date_submitted) = ?)' : 'r.report_id = ?');
      params.push(filters.search.id);
      if (filters.search.year) params.push(filters.search.year);
    }
    where.push(`(${conditions.join(' OR ')})`);
  }

  const whereSql = where.join(' AND ');

  const [countRows] = await pool.execute(`SELECT COUNT(*) AS total FROM report r WHERE ${whereSql}`, params);
  const total = Number(countRows[0].total);

  // page is a validated whole number, so it is safe to put into LIMIT/OFFSET.
  const offset = (filters.page - 1) * TEAM_PAGE_SIZE;
  const [rows] = await pool.execute(
    `SELECT r.report_id AS id, r.issue_type AS issueType, r.area, r.priority, r.location,
            r.date_submitted AS dateSubmitted, r.status, ${SmartRules.overdueSql('r')} AS isOverdue
     FROM report r
     WHERE ${whereSql}
     ORDER BY r.date_submitted DESC, r.report_id DESC
     LIMIT ${TEAM_PAGE_SIZE} OFFSET ${offset}`,
    params,
  );

  return {
    reports: rows.map(SmartRules.withOverdueFlag),
    total,
    page: filters.page,
    pageSize: TEAM_PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / TEAM_PAGE_SIZE)),
  };
}

/**
 * One report with the resident's and team's names, or null.
 * Used by the response team page and the LGU page. teamId is included so
 * controllers can check who may see it.
 */
async function findWithNames(reportId) {
  const [rows] = await pool.execute(
    `SELECT r.report_id AS id, r.team_id AS teamId, t.team_name AS teamName,
            r.issue_type AS issueType, r.area, r.priority,
            r.similar_to_report_id AS similarToReportId,
            r.location, r.description, r.date_submitted AS dateSubmitted, r.status,
            r.resolution_notes AS resolutionNotes, s.name AS residentName,
            ${SmartRules.overdueSql('r')} AS isOverdue
     FROM report r
     JOIN resident s ON s.resident_id = r.resident_id
     LEFT JOIN response_team t ON t.team_id = r.team_id
     WHERE r.report_id = ?`,
    [reportId],
  );
  return rows[0] ? SmartRules.withOverdueFlag(rows[0]) : null;
}

// The next status a RESPONSE TEAM may set. (Submitted -> Under Review happens
// only when the LGU assigns the report, see assignToTeam.)
const TEAM_NEXT_STATUS = {
  'Under Review': 'In Progress',
  'In Progress': 'Resolved',
};

// Adds a status-change notification for the resident (inside a transaction).
async function notifyStatusChange(connection, report, status) {
  const message = statusChangeMessage(formatReportId(report.id, report.dateSubmitted), report.issueType, status);
  await connection.execute(
    `INSERT INTO notification (report_id, message, date_sent, status)
     VALUES (?, ?, NOW(), 'Unread')`,
    [report.id, message],
  );
}

/**
 * A response team moves ITS report to the next status.
 * In ONE transaction (all saved, or nothing):
 *   - the report must be assigned to this team
 *   - newStatus must be exactly the next status (Under Review -> In Progress -> Resolved)
 *   - saves status + resolution notes and notifies the resident
 *
 * Returns { result: 'updated', report } or
 *         { result: 'not_found' | 'not_assigned' | 'invalid_status' | 'notes_required' }.
 */
async function updateStatusByTeam(teamId, reportId, { status, resolutionNotes }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT report_id AS id, team_id AS teamId, issue_type AS issueType, status,
              date_submitted AS dateSubmitted, resolution_notes AS resolutionNotes
       FROM report WHERE report_id = ? FOR UPDATE`,
      [reportId],
    );
    const report = rows[0];

    let problem = null;
    if (!report) problem = 'not_found';
    else if (report.teamId !== teamId) problem = 'not_assigned';
    else if (TEAM_NEXT_STATUS[report.status] !== status) problem = 'invalid_status';

    // Keep earlier notes if none were typed this time.
    const notes = resolutionNotes || report?.resolutionNotes || null;
    if (!problem && status === 'Resolved' && !notes) problem = 'notes_required';

    if (problem) {
      await connection.rollback();
      return { result: problem };
    }

    await connection.execute('UPDATE report SET status = ?, resolution_notes = ? WHERE report_id = ?', [status, notes, reportId]);
    await notifyStatusChange(connection, report, status);
    await StaffNotification.notifyAllLgu(connection, 'status_changed', { reportId, detail: status });

    await connection.commit();
    return { result: 'updated', report: await findWithNames(reportId) };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * The LGU assigns a report to a response team.
 *   - Submitted report: team is set and the status becomes Under Review
 *     automatically; the resident is notified.
 *   - Under Review / In Progress: the report is moved to another team
 *     (status unchanged, no notification).
 *   - Resolved reports cannot be reassigned.
 * Returns { result: 'assigned', report } or { result: 'not_found' | 'team_not_found' | 'resolved' }.
 */
async function assignToTeam(reportId, teamId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT report_id AS id, team_id AS teamId, issue_type AS issueType, status,
              date_submitted AS dateSubmitted
       FROM report WHERE report_id = ? FOR UPDATE`,
      [reportId],
    );
    const report = rows[0];
    const [teams] = await connection.execute('SELECT team_name AS teamName FROM response_team WHERE team_id = ?', [teamId]);

    let problem = null;
    if (!report) problem = 'not_found';
    else if (teams.length === 0) problem = 'team_not_found';
    else if (report.status === 'Resolved') problem = 'resolved';
    if (problem) {
      await connection.rollback();
      return { result: problem };
    }

    if (report.status === 'Submitted') {
      await connection.execute("UPDATE report SET team_id = ?, status = 'Under Review' WHERE report_id = ?", [teamId, reportId]);
      // "Your report #2026-0101 has been assigned to Team Bravo and is now Under Review."
      await connection.execute(
        `INSERT INTO notification (report_id, message, date_sent, status)
         VALUES (?, ?, NOW(), 'Unread')`,
        [report.id, assignedMessage(formatReportId(report.id, report.dateSubmitted), teams[0].teamName)],
      );
    } else {
      await connection.execute('UPDATE report SET team_id = ? WHERE report_id = ?', [teamId, reportId]);
    }
    // Tell the (new) team, unless the report was "reassigned" to the same team.
    if (report.teamId !== teamId) await StaffNotification.notifyTeam(connection, teamId, 'assigned', { reportId });

    await connection.commit();
    return { result: 'assigned', report: await findWithNames(reportId) };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Reports linked to this one by the similar-report rule, BOTH ways:
 *   - the report this one is similar to, and
 *   - newer reports that are similar to this one.
 * Only reports the viewer may open are returned (LGU: all; team: assigned
 * to it; resident: their own). Returns [{ id, displayId }], oldest first.
 */
async function findLinkedReports(reportId, user) {
  const [rows] = await pool.execute(
    `SELECT report_id AS id, date_submitted AS dateSubmitted, resident_id AS residentId, team_id AS teamId
     FROM report
     WHERE report_id = (SELECT similar_to_report_id FROM report WHERE report_id = ?)
        OR similar_to_report_id = ?
     ORDER BY date_submitted, report_id`,
    [reportId, reportId],
  );
  const canOpen = (row) =>
    user.role === 'lgu' ||
    (user.role === 'response_team' && row.teamId === user.id) ||
    (user.role === 'resident' && row.residentId === user.id);
  return rows.filter(canOpen).map((row) => ({ id: row.id, displayId: formatReportId(row.id, row.dateSubmitted) }));
}

/**
 * Overdue reports (not Resolved, submitted more than OVERDUE_DAYS days ago),
 * oldest first. teamId = a team's id (only its assigned reports) or null (LGU: all).
 * Returns { total, overdueDays, reports }.
 */
async function findOverdue(teamId) {
  const where = [SmartRules.overdueSql('r')];
  const params = [];
  if (teamId !== null) {
    where.push('r.team_id = ?'); // a team never sees another team's reports
    params.push(teamId);
  }
  const [rows] = await pool.execute(
    `SELECT r.report_id AS id, r.issue_type AS issueType, r.area, r.priority, r.location,
            r.date_submitted AS dateSubmitted, r.status, t.team_name AS teamName,
            DATEDIFF(NOW(), r.date_submitted) AS daysOpen, 1 AS isOverdue
     FROM report r
     LEFT JOIN response_team t ON t.team_id = r.team_id
     WHERE ${where.join(' AND ')}
     ORDER BY r.date_submitted, r.report_id`,
    params,
  );
  return { total: rows.length, overdueDays: SmartRules.OVERDUE_DAYS, reports: rows.map(SmartRules.withOverdueFlag) };
}

const ADMIN_PAGE_SIZE = 10;

/**
 * LGU Reports list: every report, with the assigned team's name.
 *   filters: { status, priority, area, issueType, unassigned, overdue, page }
 * Sorted by priority (High, Medium, Low), then oldest first, so the most
 * urgent and longest-waiting reports are at the top.
 * Returns { reports, total, unassignedTotal, page, pageSize, totalPages }.
 */
async function findForAdmin(filters) {
  const where = ['1 = 1'];
  const params = [];
  const add = (sql, value) => {
    where.push(sql);
    params.push(value);
  };
  if (filters.status) add('r.status = ?', filters.status);
  if (filters.priority) add('r.priority = ?', filters.priority);
  if (filters.area) add('r.area = ?', filters.area);
  if (filters.issueType) add('r.issue_type = ?', filters.issueType);
  if (filters.unassigned) where.push('r.team_id IS NULL');
  if (filters.overdue) where.push(SmartRules.overdueSql('r'));
  const whereSql = where.join(' AND ');

  const [countRows] = await pool.execute(`SELECT COUNT(*) AS total FROM report r WHERE ${whereSql}`, params);
  const total = Number(countRows[0].total);
  const [unassignedRows] = await pool.query('SELECT COUNT(*) AS total FROM report WHERE team_id IS NULL');

  // page is a validated whole number, so it is safe to put into LIMIT/OFFSET.
  const offset = (filters.page - 1) * ADMIN_PAGE_SIZE;
  const [rows] = await pool.execute(
    `SELECT r.report_id AS id, r.issue_type AS issueType, r.area, r.priority, r.location,
            r.description, r.date_submitted AS dateSubmitted, r.status,
            r.team_id AS teamId, t.team_name AS teamName, ${SmartRules.overdueSql('r')} AS isOverdue
     FROM report r
     LEFT JOIN response_team t ON t.team_id = r.team_id
     WHERE ${whereSql}
     ORDER BY FIELD(r.priority, 'High', 'Medium', 'Low'), r.date_submitted ASC, r.report_id ASC
     LIMIT ${ADMIN_PAGE_SIZE} OFFSET ${offset}`,
    params,
  );

  return {
    reports: rows.map(SmartRules.withOverdueFlag),
    total,
    unassignedTotal: Number(unassignedRows[0].total),
    page: filters.page,
    pageSize: ADMIN_PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)),
  };
}

module.exports = {
  TEAM_NEXT_STATUS,
  findForAdmin,
  findByResident,
  findById,
  createWithNotification,
  findForTeam,
  findWithNames,
  findLinkedReports,
  findOverdue,
  updateStatusByTeam,
  assignToTeam,
};
