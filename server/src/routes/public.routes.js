/**
 * Public routes for the landing page (no login needed):
 *   GET /api/public/resolved-cases            - visible featured cases (max 10), no personal data
 *   GET /api/public/resolved-cases/:id/photo  - the "after" photo of a visible case
 *   GET /api/public/contact                   - barangay contact details + today's live chat hours
 *   GET /api/public/hotlines                  - emergency hotlines (911 first, unconfirmed ones flagged)
 */
const express = require('express');
const { listPublicCases, getPublicPhoto } = require('../controllers/featured.controller');
const { getContact, getHotlines } = require('../controllers/publicInfo.controller');

const router = express.Router();

router.get('/resolved-cases', listPublicCases);
router.get('/resolved-cases/:id/photo', getPublicPhoto);
router.get('/contact', getContact);
router.get('/hotlines', getHotlines);

module.exports = router;
