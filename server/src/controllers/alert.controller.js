/**
 * GET /api/alerts/overdue - overdue reports (not Resolved, submitted more than
 * OVERDUE_DAYS days ago; see services/smartRules.js).
 * LGU: all overdue reports. Response team: only the reports assigned to it.
 * Returns { total, overdueDays, reports }.
 */
const Report = require('../models/report.model');

async function getOverdue(req, res) {
  const teamId = req.user.role === 'response_team' ? req.user.id : null;
  return res.json(await Report.findOverdue(teamId));
}

module.exports = { getOverdue };
