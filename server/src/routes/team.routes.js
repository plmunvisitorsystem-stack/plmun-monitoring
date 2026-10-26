/**
 * Response team routes (mounted at /api/team in app.js, which already
 * requires a valid token with role "response_team"):
 *   GET   /api/team/reports      - reports list with filters, search, and pages
 *   GET   /api/team/reports/:id  - one report (unassigned or this team's)
 *   PATCH /api/team/reports/:id  - move to the next status + resolution notes
 */
const express = require('express');
const { listTeamReports, getTeamReport, updateTeamReport } = require('../controllers/team.controller');

const router = express.Router();

router.get('/reports', listTeamReports);
router.get('/reports/:id', getTeamReport);
router.patch('/reports/:id', updateTeamReport);

module.exports = router;
