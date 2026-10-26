/**
 * Reporting module.
 * requireAuth + requireRole(...) run before these functions,
 * so req.user = { id, role } is always the logged-in account.
 */
const Report = require('../models/report.model');
const Feedback = require('../models/feedback.model');
const Photo = require('../models/photo.model');
const { validateReport, validateFeedback, validateSimilarQuery } = require('../utils/validators');
const SmartRules = require('../../services/smartRules');
const { pool } = require('../config/db');

/** POST /api/reports - a resident submits a new report. */
async function createReport(req, res) {
  const { values, errors } = validateReport(req.body || {});

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ code: 'VALIDATION_FAILED', message: 'Please correct the highlighted fields.', fields: errors });
  }

  const { report, duplicate } = await Report.createWithNotification(req.user.id, values, req.files || []);

  // 201 = a new report was created; 200 = the same report was sent twice
  // (double-click), so we return the one that already exists.
  return res.status(duplicate ? 200 : 201).json({ report });
}

/**
 * GET /api/reports/:id - one report.
 * A resident may only open their OWN report:
 *   not a valid id / does not exist -> 404
 *   belongs to another resident     -> 403
 */
async function getReport(req, res) {
  const reportId = Number(req.params.id);
  if (!Number.isInteger(reportId) || reportId <= 0) {
    return res.status(404).json({ code: 'NOT_FOUND', message: 'Report not found.' });
  }

  const report = await Report.findById(reportId);
  if (!report) {
    return res.status(404).json({ code: 'NOT_FOUND', message: 'Report not found.' });
  }

  if (req.user.role === 'resident' && report.residentId !== req.user.id) {
    return res.status(403).json({ code: 'FORBIDDEN', message: 'You can only view your own reports.' });
  }

  // residentId was only needed for the check above; do not send it.
  // (report.feedback holds the resident's own rating, if given.)
  const { residentId, ...publicReport } = report;
  return res.json({
    report: {
      ...publicReport,
      photos: await Photo.findByReport(reportId),
      linkedReports: await Report.findLinkedReports(reportId, req.user),
    },
  });
}

// Answer for each reason feedback cannot be saved.
const FEEDBACK_PROBLEMS = {
  not_found: [404, 'NOT_FOUND', 'Report not found.'],
  not_owner: [403, 'FORBIDDEN', 'You can only give feedback on your own reports.'],
  not_resolved: [409, 'REPORT_NOT_RESOLVED', 'Feedback can only be given after the report is resolved.'],
  exists: [409, 'FEEDBACK_EXISTS', 'Feedback was already sent for this report.'],
};

/**
 * POST /api/reports/:id/feedback - a resident rates how their Resolved
 * report was handled (rating 1-5, optional comments). Only once per report.
 */
async function createFeedback(req, res) {
  const reportId = Number(req.params.id);
  if (!Number.isInteger(reportId) || reportId <= 0) {
    return res.status(404).json({ code: 'NOT_FOUND', message: 'Report not found.' });
  }

  const { values, errors } = validateFeedback(req.body || {});
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ code: 'VALIDATION_FAILED', message: 'Please correct the highlighted fields.', fields: errors });
  }

  const outcome = await Feedback.createOnce(req.user.id, reportId, values);
  if (outcome.result !== 'saved') {
    const [status, code, message] = FEEDBACK_PROBLEMS[outcome.result];
    return res.status(status).json({ code, message });
  }

  return res.status(201).json({ feedback: outcome.feedback });
}

/**
 * GET /api/reports/similar?issue_type=&area=
 * Used by the Submit Report page to warn the resident BEFORE submitting.
 * Returns { similar: { dateSubmitted } } for the newest unresolved report with
 * the same issue type and area within SIMILAR_DAYS days, or { similar: null }.
 * Only the date is sent: residents must not see other residents' reports.
 */
async function getSimilarReport(req, res) {
  const { values, errors } = validateSimilarQuery(req.query);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ code: 'INVALID_FILTER', message: 'Invalid issue type or area.', fields: errors });
  }
  const similar = await SmartRules.findSimilarReport(pool, values);
  return res.json({ similar: similar ? { dateSubmitted: similar.dateSubmitted } : null });
}

module.exports = { createReport, getReport, createFeedback, getSimilarReport };
