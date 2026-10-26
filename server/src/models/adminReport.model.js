/**
 * LGU monitoring and report generation queries.
 */
const { pool } = require('../config/db');
const SmartRules = require('../../services/smartRules');

const STATUSES = ['Submitted', 'Under Review', 'In Progress', 'Resolved'];
const ISSUE_TYPES = ['Waste Disposal', 'Pollution', 'Flooding', 'Other Hazard'];

const zeroCounts = (keys) => Object.fromEntries(keys.map((key) => [key, 0]));

/**
 * Performance overview: totals per status, per issue type, per response team,
 * and the resolution rate (Resolved / Total).
 */
async function getPerformance() {
  const [statusRows] = await pool.query('SELECT status AS k, COUNT(*) AS n FROM report GROUP BY status');
  const [issueRows] = await pool.query('SELECT issue_type AS k, COUNT(*) AS n FROM report GROUP BY issue_type');

  // Every team (also teams with no reports yet, thanks to LEFT JOIN).
  const [teamRows] = await pool.query(
    `SELECT t.team_id AS id, t.team_name AS teamName, t.assigned_area AS assignedArea,
            COUNT(r.report_id) AS assigned,
            COALESCE(SUM(r.status = 'Under Review'), 0) AS underReview,
            COALESCE(SUM(r.status = 'In Progress'), 0) AS inProgress,
            COALESCE(SUM(r.status = 'Resolved'), 0) AS resolved
     FROM response_team t
     LEFT JOIN report r ON r.team_id = t.team_id
     GROUP BY t.team_id, t.team_name, t.assigned_area
     ORDER BY t.team_name`,
  );
  const [[{ unassigned }]] = await pool.query('SELECT COUNT(*) AS unassigned FROM report WHERE team_id IS NULL');

  const byStatus = zeroCounts(STATUSES);
  for (const row of statusRows) byStatus[row.k] = Number(row.n);
  const byIssueType = zeroCounts(ISSUE_TYPES);
  for (const row of issueRows) byIssueType[row.k] = Number(row.n);

  const total = Object.values(byStatus).reduce((sum, n) => sum + n, 0);
  const rate = (part, whole) => (whole > 0 ? part / whole : 0);

  const teams = teamRows.map((row) => {
    const team = {
      id: row.id,
      teamName: row.teamName,
      assignedArea: row.assignedArea,
      assigned: Number(row.assigned),
      underReview: Number(row.underReview),
      inProgress: Number(row.inProgress),
      resolved: Number(row.resolved),
    };
    return { ...team, resolutionRate: rate(team.resolved, team.assigned) };
  });

  return {
    total,
    byStatus,
    byIssueType,
    teams,
    unassigned: Number(unassigned),
    resolutionRate: rate(byStatus.Resolved, total), // 0.375 = 37.5%
  };
}

/**
 * Reports matching the filters (date range, issue type, status), oldest first,
 * with the team and resident names. Used for the report page, print, and CSV.
 */
async function findForExport({ dateFrom, dateTo, issueType, status, overdue }) {
  const where = [];
  const params = [];
  if (dateFrom) {
    where.push('r.date_submitted >= ?');
    params.push(`${dateFrom} 00:00:00`);
  }
  if (dateTo) {
    where.push('r.date_submitted < DATE_ADD(?, INTERVAL 1 DAY)');
    params.push(dateTo);
  }
  if (issueType) {
    where.push('r.issue_type = ?');
    params.push(issueType);
  }
  if (status) {
    where.push('r.status = ?');
    params.push(status);
  }
  if (overdue) where.push(SmartRules.overdueSql('r'));

  const [rows] = await pool.execute(
    `SELECT r.report_id AS id, r.date_submitted AS dateSubmitted, r.issue_type AS issueType,
            r.area, r.priority, r.location, r.description, r.status, t.team_name AS teamName,
            s.name AS residentName, r.resolution_notes AS resolutionNotes,
            ${SmartRules.overdueSql('r')} AS isOverdue
     FROM report r
     JOIN resident s ON s.resident_id = r.resident_id
     LEFT JOIN response_team t ON t.team_id = r.team_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY r.date_submitted, r.report_id`,
    params,
  );
  return rows.map(SmartRules.withOverdueFlag);
}

/**
 * Summary computed FROM the rows themselves, so the totals always equal the
 * number of matching rows. Months are "YYYY-MM"; months with no reports
 * between the first and last month are included with 0.
 */
function summarize(rows, { dateFrom, dateTo }) {
  const byStatus = zeroCounts(STATUSES);
  const byIssueType = zeroCounts(ISSUE_TYPES);
  const monthCounts = {};

  for (const row of rows) {
    byStatus[row.status] += 1;
    byIssueType[row.issueType] += 1;
    const month = row.dateSubmitted.slice(0, 7);
    monthCounts[month] = (monthCounts[month] || 0) + 1;
  }

  // Month range: the date filter if given, otherwise the first..last report.
  const months = Object.keys(monthCounts).sort();
  const first = dateFrom ? dateFrom.slice(0, 7) : months[0];
  const last = dateTo ? dateTo.slice(0, 7) : months[months.length - 1];
  const byMonth = [];
  if (first && last) {
    let [year, month] = first.split('-').map(Number);
    const [lastYear, lastMonth] = last.split('-').map(Number);
    // Safety limit: at most 10 years of months.
    while ((year < lastYear || (year === lastYear && month <= lastMonth)) && byMonth.length < 120) {
      const key = `${year}-${String(month).padStart(2, '0')}`;
      byMonth.push({ month: key, count: monthCounts[key] || 0 });
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
  }

  return { total: rows.length, byStatus, byIssueType, byMonth };
}

module.exports = { getPerformance, findForExport, summarize };
