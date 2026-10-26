/**
 * LGU administration tools (Manage Users).
 * requireAuth + requireRole('lgu') run before every function here,
 * so residents and response teams always get 403.
 */
const bcrypt = require('bcrypt');
const Account = require('../models/account.model');
const { validateUserFilters, validateNewTeam, validateProfile, validateAccountStatus } = require('../utils/validators');

const SALT_ROUNDS = 10;

// Reads :id from the URL; returns a positive whole number or null.
function readId(req) {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function validationFailed(res, fields) {
  return res.status(400).json({ code: 'VALIDATION_FAILED', message: 'Please correct the highlighted fields.', fields });
}

/** GET /api/admin/users?role=&status=&search= - residents and response teams. */
async function listUsers(req, res) {
  const { filters, errors } = validateUserFilters(req.query);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ code: 'INVALID_FILTER', message: 'Invalid filter values.', fields: errors });
  }
  const users = await Account.listUsers(filters);
  return res.json({ users });
}

/** POST /api/admin/teams - adds a response team account. */
async function createTeam(req, res) {
  const { values, errors } = validateNewTeam(req.body || {});
  if (Object.keys(errors).length > 0) return validationFailed(res, errors);

  // Usernames must be unique across residents, teams, and LGU accounts.
  const taken = { code: 'USERNAME_TAKEN', message: 'This username is already taken.', fields: { username: 'USERNAME_TAKEN' } };
  if (await Account.usernameExists(values.username)) return res.status(409).json(taken);

  const passwordHash = await bcrypt.hash(values.password, SALT_ROUNDS);
  try {
    const id = await Account.createTeam({ ...values, passwordHash });
    const profile = await Account.getProfile('response_team', id);
    return res.status(201).json({ team: { id, ...profile } });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json(taken);
    throw error;
  }
}

/** PUT /api/admin/teams/:id - edits a team's name, assigned area, and contact info. */
async function updateTeam(req, res) {
  const id = readId(req);
  const notFound = { code: 'NOT_FOUND', message: 'Response team not found.' };
  if (!id) return res.status(404).json(notFound);

  const { values, errors } = validateProfile('response_team', req.body || {});
  if (Object.keys(errors).length > 0) return validationFailed(res, errors);

  if (!(await Account.getProfile('response_team', id))) return res.status(404).json(notFound);

  await Account.updateProfile('response_team', id, values);
  const profile = await Account.getProfile('response_team', id);
  return res.json({ team: { id, ...profile } });
}

/** PATCH /api/admin/residents/:id/status  { status: 'Active' | 'Inactive' } */
async function setResidentStatus(req, res) {
  const id = readId(req);
  const notFound = { code: 'NOT_FOUND', message: 'Resident not found.' };
  if (!id) return res.status(404).json(notFound);

  const { status, errors } = validateAccountStatus(req.body || {});
  if (Object.keys(errors).length > 0) return validationFailed(res, errors);

  if (!(await Account.setResidentStatus(id, status))) return res.status(404).json(notFound);
  // An Inactive resident is blocked at login AND on every request with an
  // older token (requireAuth checks account_status), so the change is immediate.
  return res.json({ resident: { id, accountStatus: status } });
}

// ----- Monitor Performance & Generate Reports -----
const AdminReport = require('../models/adminReport.model');
const { validateReportFilters, validateAssignFilters } = require('../utils/validators');
const { formatReportId } = require('../utils/format');
const { toCsv } = require('../utils/csv');
const SmartRules = require('../../services/smartRules');
const Featured = require('../models/featured.model');
const { forLgu } = require('./featured.controller');

// The report's featured case (landing page slideshow), or null.
async function featuredOf(reportId) {
  const featured = await Featured.findByReport(reportId);
  return featured ? forLgu(featured) : null;
}
const RULES = require('../../config/rules');
const { pool } = require('../config/db');

const ISSUE_TYPES = ['Waste Disposal', 'Pollution', 'Flooding', 'Other Hazard'];

/** GET /api/admin/performance */
async function getPerformance(req, res) {
  return res.json(await AdminReport.getPerformance());
}

/**
 * GET /api/admin/reports/export?dateFrom=&dateTo=&issueType=&status=[&format=csv]
 * JSON: { filters, summary, rows, hotspots }   CSV (format=csv): the same rows as a file,
 * followed by the hotspot table. Hotspots always cover the last HOTSPOT_DAYS days
 * (they do not follow the date filters).
 */
async function exportReports(req, res) {
  const { filters, errors } = validateReportFilters(req.query);
  if (Object.keys(errors).length > 0) {
    const code = Object.values(errors).includes('INVALID_DATE_RANGE') ? 'INVALID_DATE_RANGE' : 'INVALID_FILTER';
    return res.status(400).json({ code, message: 'Invalid filter values.', fields: errors });
  }

  const rows = (await AdminReport.findForExport(filters)).map((row) => ({
    ...row,
    displayId: formatReportId(row.id, row.dateSubmitted),
  }));
  const hotspots = {
    days: RULES.HOTSPOT_DAYS,
    minReports: RULES.HOTSPOT_COUNT,
    hotspots: await SmartRules.findHotspots(pool),
  };
  const usedFilters = { dateFrom: filters.dateFrom, dateTo: filters.dateTo, issueType: filters.issueType, status: filters.status, overdue: filters.overdue };

  if (req.query.format === 'csv') {
    const csv = toCsv(
      ['Report ID', 'Date Submitted', 'Issue Type', 'Area', 'Priority', 'Location', 'Description', 'Status', 'Assigned Team', 'Resident', 'Resolution Notes'],
      rows.map((r) => [
        r.displayId,
        r.dateSubmitted.slice(0, 16), // "2026-10-09 05:45" - Excel reads this as a date and time
        r.issueType,
        r.area,
        r.priority,
        r.location,
        r.description,
        r.status,
        r.teamName || 'Not assigned',
        r.residentName,
        r.resolutionNotes || '',
      ]),
      [
        {
          title: `Hotspots (last ${hotspots.days} days, ${hotspots.minReports} or more reports)`,
          headers: ['Rank', 'Area', 'Total Reports', 'Most Common Issue Type', ...ISSUE_TYPES],
          rows: hotspots.hotspots.length
            ? hotspots.hotspots.map((h, i) => [i + 1, h.area, h.total, h.topIssueType, ...ISSUE_TYPES.map((type) => h.byIssueType[type])])
            : [['No hotspots right now']],
        },
      ],
    );
    const today = new Date().toISOString().slice(0, 10);
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="landayan-reports-${today}.csv"`);
    return res.send(csv);
  }

  return res.json({ filters: usedFilters, summary: AdminReport.summarize(rows, filters), rows, hotspots });
}

// ----- Assign reports to response teams -----
const Report = require('../models/report.model');
const Photo = require('../models/photo.model');

// The LGU page shows the report, the resident and team names, the photos,
// and the linked similar reports.
async function forAdmin(report, user) {
  return {
    ...report,
    photos: await Photo.findByReport(report.id),
    linkedReports: await Report.findLinkedReports(report.id, user),
    featured: await featuredOf(report.id),
    dateResolved: await Featured.findDateResolved(report.id),
  };
}

/**
 * GET /api/admin/reports?status=&priority=&area=&issueType=&unassigned=1&page=
 * All reports, High priority first, then oldest first.
 */
async function listReports(req, res) {
  const { filters, errors } = validateAssignFilters(req.query);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ code: 'INVALID_FILTER', message: 'Invalid filter values.', fields: errors });
  }
  return res.json(await Report.findForAdmin(filters));
}

/**
 * GET /api/admin/reports/:id - one report for the LGU, plus every response
 * team and whether its assigned_area covers the report's area (suggested team).
 */
async function getReportForAdmin(req, res) {
  const id = readId(req);
  const notFound = { code: 'NOT_FOUND', message: 'Report not found.' };
  if (!id) return res.status(404).json(notFound);

  const report = await Report.findWithNames(id);
  if (!report) return res.status(404).json(notFound);

  const teams = (await Account.listTeams()).map((team) => ({
    ...team,
    coversArea: team.assignedArea.split(',').map((a) => a.trim()).includes(report.area),
  }));
  return res.json({ report: await forAdmin(report, req.user), teams });
}

// Answer for each reason an assignment is refused.
const ASSIGN_PROBLEMS = {
  not_found: [404, { code: 'NOT_FOUND', message: 'Report not found.' }],
  team_not_found: [400, { code: 'TEAM_NOT_FOUND', message: 'Please choose a response team.', fields: { teamId: 'TEAM_NOT_FOUND' } }],
  resolved: [409, { code: 'REPORT_ALREADY_RESOLVED', message: 'A resolved report cannot be reassigned.' }],
};

/**
 * PATCH /api/admin/reports/:id/assign  { team_id }   (teamId is also accepted)
 * Submitted -> the team is set and the status becomes Under Review (resident notified).
 * Under Review / In Progress -> moved to another team (status unchanged).
 * Resolved -> refused.
 */
async function assignReport(req, res) {
  const id = readId(req);
  if (!id) return res.status(404).json(ASSIGN_PROBLEMS.not_found[1]);

  const body = req.body || {};
  const teamId = Number(body.team_id ?? body.teamId);
  if (!Number.isInteger(teamId) || teamId <= 0) return res.status(400).json(ASSIGN_PROBLEMS.team_not_found[1]);

  const outcome = await Report.assignToTeam(id, teamId);
  if (outcome.result !== 'assigned') {
    const [status, body] = ASSIGN_PROBLEMS[outcome.result];
    return res.status(status).json(body);
  }
  return res.json({ report: await forAdmin(outcome.report, req.user) });
}

module.exports = {
  listUsers,
  createTeam,
  updateTeam,
  setResidentStatus,
  getPerformance,
  exportReports,
  listReports,
  getReportForAdmin,
  assignReport,
};
