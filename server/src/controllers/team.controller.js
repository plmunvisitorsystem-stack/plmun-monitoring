/**
 * Response team features. requireAuth + requireRole('response_team') run
 * first, so req.user.id is the logged-in team's team_id.
 * A team sees and updates ONLY reports the LGU assigned to it.
 */
const Report = require('../models/report.model');
const { validateReportFilters, validateStatusUpdate } = require('../utils/validators');
const Photo = require('../models/photo.model');

const NOT_FOUND = { code: 'NOT_FOUND', message: 'Report not found.' };
const NOT_ASSIGNED = { code: 'NOT_ASSIGNED_TO_TEAM', message: 'This report is not assigned to your team.' };

// Reads :id from the URL; returns a positive whole number or null.
function readReportId(req) {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// What the team page receives: no internal ids, plus the allowed next status,
// the photos, and the similar reports this team may open.
async function forTeam(report, user) {
  const { teamId, ...rest } = report;
  return {
    ...rest,
    nextStatus: Report.TEAM_NEXT_STATUS[report.status] || null,
    photos: await Photo.findByReport(report.id),
    linkedReports: await Report.findLinkedReports(report.id, user),
  };
}

/**
 * GET /api/team/reports?issueType=&status=&dateFrom=&dateTo=&search=&page=
 * Reports assigned to this team, 10 per page, newest first.
 */
async function listTeamReports(req, res) {
  const { filters, errors } = validateReportFilters(req.query);

  if (Object.keys(errors).length > 0) {
    const code = Object.values(errors).includes('INVALID_DATE_RANGE') ? 'INVALID_DATE_RANGE' : 'INVALID_FILTER';
    return res.status(400).json({ code, message: 'Invalid filter values.', fields: errors });
  }

  const result = await Report.findForTeam(req.user.id, filters);
  return res.json(result);
}

/** GET /api/team/reports/:id - one of this team's reports, with the resident's name. */
async function getTeamReport(req, res) {
  const reportId = readReportId(req);
  if (!reportId) return res.status(404).json(NOT_FOUND);

  const report = await Report.findWithNames(reportId);
  if (!report) return res.status(404).json(NOT_FOUND);
  if (report.teamId !== req.user.id) return res.status(403).json(NOT_ASSIGNED);

  return res.json({ report: await forTeam(report, req.user) });
}

// Answer for each reason an update is refused.
const UPDATE_PROBLEMS = {
  not_found: [404, NOT_FOUND],
  not_assigned: [403, NOT_ASSIGNED],
  invalid_status: [409, { code: 'INVALID_STATUS_CHANGE', message: 'Reports can only move to the next status.' }],
  notes_required: [400, { code: 'NOTES_REQUIRED', message: 'Resolution notes are required to resolve a report.', fields: { resolutionNotes: 'NOTES_REQUIRED' } }],
};

/**
 * PATCH /api/team/reports/:id  { status, resolutionNotes }
 * Under Review -> In Progress -> Resolved only; saves the notes and notifies the resident.
 */
async function updateTeamReport(req, res) {
  const reportId = readReportId(req);
  if (!reportId) return res.status(404).json(NOT_FOUND);

  const { values, errors } = validateStatusUpdate(req.body || {});
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ code: 'VALIDATION_FAILED', message: 'Please correct the highlighted fields.', fields: errors });
  }

  const outcome = await Report.updateStatusByTeam(req.user.id, reportId, values);
  if (outcome.result !== 'updated') {
    const [status, body] = UPDATE_PROBLEMS[outcome.result];
    return res.status(status).json(body);
  }

  return res.json({ report: await forTeam(outcome.report, req.user) });
}

module.exports = { listTeamReports, getTeamReport, updateTeamReport };
