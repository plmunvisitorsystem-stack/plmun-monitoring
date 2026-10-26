/**
 * Resident features. requireAuth + requireRole('resident') run before these,
 * so req.user.id is always the logged-in resident's id.
 * (A single report is opened with GET /api/reports/:id - see report.controller.js.)
 */
const Report = require('../models/report.model');

/** GET /api/resident/reports - the logged-in resident's reports, newest first. */
async function listMyReports(req, res) {
  const reports = await Report.findByResident(req.user.id);
  return res.json({ reports });
}

module.exports = { listMyReports };
