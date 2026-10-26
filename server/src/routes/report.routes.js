/**
 * Report routes (mounted at /api/reports in app.js, which already requires
 * a valid login token). Each route lists which roles may use it.
 *   POST /api/reports               - submit a new report with optional photos (residents only)
 *   GET  /api/reports/similar       - ?issue_type=&area= : is there a similar unresolved report? (residents only)
 *   GET  /api/reports/:id           - one report (residents: own reports only)
 *   POST /api/reports/:id/feedback  - rate a Resolved report once (residents only)
 */
const express = require('express');
const { createReport, getReport, createFeedback, getSimilarReport } = require('../controllers/report.controller');
const { requireRole } = require('../middleware/auth');
const { uploadPhotos } = require('../middleware/uploadPhotos');

const router = express.Router();

// JSON or multipart/form-data with up to MAX_PHOTOS files in the field "photos"
router.post('/', requireRole('resident'), uploadPhotos, createReport);
router.get('/similar', requireRole('resident'), getSimilarReport); // must come before /:id
router.get('/:id', requireRole('resident'), getReport);
router.post('/:id/feedback', requireRole('resident'), createFeedback);

module.exports = router;
