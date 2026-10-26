/**
 * Dashboard numbers.
 * scope: { teamId } for a response team (only reports assigned to it)
 *        { teamId: null } for the LGU (all reports)
 */
const { pool } = require('../config/db');
const SmartRules = require('../../services/smartRules');

const STATUSES = ['Submitted', 'Under Review', 'In Progress', 'Resolved'];
const ISSUE_TYPES = ['Waste Disposal', 'Pollution', 'Flooding', 'Other Hazard'];

// WHERE part + parameters for the scope. Same rule as the team Reports List.
function scopeWhere(teamId) {
  if (teamId === null) return { sql: '1 = 1', params: [] };
  return { sql: 'team_id = ?', params: [teamId] }; // a team sees only reports assigned to it
}

// Turns [{ key, total }] into { key: total } with every expected key (missing -> 0).
function toCounts(rows, keys) {
  const counts = Object.fromEntries(keys.map((key) => [key, 0]));
  for (const row of rows) counts[row.key] = Number(row.total);
  return counts;
}

async function getSummary(teamId) {
  const scope = scopeWhere(teamId);

  const [statusRows] = await pool.execute(
    `SELECT status AS \`key\`, COUNT(*) AS total FROM report WHERE ${scope.sql} GROUP BY status`,
    scope.params,
  );
  const [issueRows] = await pool.execute(
    `SELECT issue_type AS \`key\`, COUNT(*) AS total FROM report WHERE ${scope.sql} GROUP BY issue_type`,
    scope.params,
  );
  // Reports per month (1-12) in the current year.
  const [monthRows] = await pool.execute(
    `SELECT MONTH(date_submitted) AS \`key\`, COUNT(*) AS total
     FROM report
     WHERE ${scope.sql} AND YEAR(date_submitted) = YEAR(CURDATE())
     GROUP BY MONTH(date_submitted)`,
    scope.params,
  );
  const [[{ year }]] = await pool.query('SELECT YEAR(CURDATE()) AS year');
  const [recentReports] = await pool.execute(
    `SELECT report_id AS id, issue_type AS issueType, location,
            date_submitted AS dateSubmitted, status, ${SmartRules.overdueSql()} AS isOverdue
     FROM report
     WHERE ${scope.sql}
     ORDER BY date_submitted DESC, report_id DESC
     LIMIT 5`,
    scope.params,
  );

  // LGU only: reports that still need a response team.
  let unassigned = null;
  if (teamId === null) {
    const [[row]] = await pool.query('SELECT COUNT(*) AS total FROM report WHERE team_id IS NULL');
    unassigned = Number(row.total);
  }

  const byStatus = toCounts(statusRows, STATUSES);
  const byIssueType = toCounts(issueRows, ISSUE_TYPES);
  const monthCounts = toCounts(monthRows, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

  return {
    total: Object.values(byStatus).reduce((sum, count) => sum + count, 0),
    byStatus,
    byIssueType,
    unassigned, // null for a response team
    byMonth: { year: Number(year), counts: Object.values(monthCounts) }, // index 0 = January
    recentReports: recentReports.map(SmartRules.withOverdueFlag),
  };
}

module.exports = { getSummary };
