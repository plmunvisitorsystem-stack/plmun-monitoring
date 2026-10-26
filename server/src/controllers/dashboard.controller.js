/**
 * GET /api/dashboard/summary
 * Response team: only the reports assigned to it.
 * LGU: all reports.
 * Returns total, counts per status, per issue type, per month (current year),
 * and the 5 most recent reports.
 */
const Dashboard = require('../models/dashboard.model');

async function getSummary(req, res) {
  const teamId = req.user.role === 'response_team' ? req.user.id : null;
  const summary = await Dashboard.getSummary(teamId);
  return res.json({ scope: teamId === null ? 'all' : 'team', ...summary });
}

module.exports = { getSummary };
