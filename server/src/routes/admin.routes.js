/**
 * LGU administration routes (mounted at /api/admin in app.js, which already
 * requires a valid token with role "lgu"; everyone else gets 403):
 *   GET   /api/admin/users                  - residents + response teams (filters, search)
 *   POST  /api/admin/teams                  - add a response team account
 *   PUT   /api/admin/teams/:id              - edit a response team's details
 *   PATCH /api/admin/residents/:id/status   - activate / deactivate a resident
 *   GET   /api/admin/performance            - totals, per team, resolution rate
 *   GET   /api/admin/reports                - all reports (filters), High priority + oldest first
 *   GET   /api/admin/reports/export         - filtered summary + rows (format=csv for a file)
 *   GET   /api/admin/reports/:id            - one report + the teams that can take it
 *   PATCH /api/admin/reports/:id/assign     - { team_id }: assign or reassign (Submitted -> Under Review)
 *   GET    /api/admin/featured-cases                 - featured cases (landing page slideshow), in order
 *   POST   /api/admin/featured-cases                 - feature a Resolved report (multipart: reportId, caption, photo)
 *   PUT    /api/admin/featured-cases/:id             - edit caption (+ optional new photo)
 *   PATCH  /api/admin/featured-cases/:id/visibility  - { isVisible }
 *   PATCH  /api/admin/featured-cases/:id/move        - { direction: "up" | "down" }
 *   DELETE /api/admin/featured-cases/:id             - remove from the slideshow
 *   GET    /api/admin/featured-cases/:id/photo       - the "after" photo
 *   GET    /api/admin/chat-schedule                  - weekly hours, upcoming special dates, open/closed now
 *   PUT    /api/admin/chat-schedule/weekly           - { days: [7 x { dayOfWeek, isOpen, start, end }] }
 *   POST   /api/admin/chat-schedule/special          - { date, isOpen, start, end } (holiday / other hours)
 *   DELETE /api/admin/chat-schedule/special/:id      - remove a special date
 */
const express = require('express');
const {
  listUsers,
  createTeam,
  updateTeam,
  setResidentStatus,
  getPerformance,
  exportReports,
  listReports,
  getReportForAdmin,
  assignReport,
} = require('../controllers/admin.controller');
const {
  listFeatured,
  createFeatured,
  updateFeatured,
  setFeaturedVisibility,
  moveFeatured,
  removeFeatured,
  getFeaturedPhotoForLgu,
} = require('../controllers/featured.controller');
const { getSchedule, saveWeekly, saveSpecial, removeSpecial } = require('../controllers/chatSchedule.controller');
const { uploadOnePhoto } = require('../middleware/uploadPhotos');

const router = express.Router();

router.get('/users', listUsers);
router.post('/teams', createTeam);
router.put('/teams/:id', updateTeam);
router.patch('/residents/:id/status', setResidentStatus);
router.get('/performance', getPerformance);
router.get('/reports', listReports);
router.get('/reports/export', exportReports); // must come before /reports/:id
router.get('/reports/:id', getReportForAdmin);
router.patch('/reports/:id/assign', assignReport);
router.get('/featured-cases', listFeatured);
router.post('/featured-cases', uploadOnePhoto, createFeatured);
router.put('/featured-cases/:id', uploadOnePhoto, updateFeatured);
router.patch('/featured-cases/:id/visibility', setFeaturedVisibility);
router.patch('/featured-cases/:id/move', moveFeatured);
router.delete('/featured-cases/:id', removeFeatured);
router.get('/featured-cases/:id/photo', getFeaturedPhotoForLgu);
router.get('/chat-schedule', getSchedule);
router.put('/chat-schedule/weekly', saveWeekly);
router.post('/chat-schedule/special', saveSpecial);
router.delete('/chat-schedule/special/:id', removeSpecial);

module.exports = router;
