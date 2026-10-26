/**
 * Featured Resolved Cases (landing page slideshow).
 *   LGU (mounted under /api/admin, so everyone else gets 403):
 *     list, feature a Resolved report, edit, show/hide, move up/down, remove,
 *     and see the "after" photo of any case (also hidden ones).
 *   Public (no login): the visible cases and their "after" photos only.
 *     Never the resident's name, contact, location text, description or
 *     the resident's own report photos.
 */
const Featured = require('../models/featured.model');
const PhotoStorage = require('../config/photoStorage');
const { cleanText } = require('../utils/validators');

const CAPTION_MAX = 200;
const NOT_FOUND = { code: 'FEATURED_NOT_FOUND', message: 'Featured case not found.' };
const NOT_RESOLVED = { code: 'FEATURE_NOT_RESOLVED', message: 'Only resolved reports can be featured on the landing page.' };

function readId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// What the LGU page gets: the case + a photo URL that needs the login token.
function forLgu(featured) {
  const { photoPath, ...rest } = featured;
  return { ...rest, photoUrl: `/api/admin/featured-cases/${featured.id}/photo` };
}

// Caption: required, max 200 characters. Returns an error code or null.
function checkCaption(caption) {
  if (!caption) return 'CAPTION_REQUIRED';
  if (caption.length > CAPTION_MAX) return 'CAPTION_TOO_LONG';
  return null;
}

function validationFailed(res, fields) {
  return res.status(400).json({ code: 'VALIDATION_FAILED', message: 'Please correct the highlighted fields.', fields });
}

// The photo comes from the server disk or Cloudinary (config/photoStorage.js).
function sendPhoto(res, photoPath, cacheControl) {
  return PhotoStorage.sendPhoto(res, photoPath, cacheControl, NOT_FOUND);
}

/** GET /api/admin/featured-cases - all featured cases, in slideshow order. */
async function listFeatured(req, res) {
  const cases = await Featured.findAll();
  return res.json({ cases: cases.map(forLgu) });
}

/** POST /api/admin/featured-cases (multipart: reportId, caption, photo) */
async function createFeatured(req, res) {
  const reportId = readId(req.body?.reportId);
  const caption = cleanText(req.body?.caption);
  const fields = {};
  const captionError = checkCaption(caption);
  if (captionError) fields.caption = captionError;
  if (!req.file) fields.photo = 'PHOTO_REQUIRED';
  if (!reportId) return res.status(404).json({ code: 'NOT_FOUND', message: 'Report not found.' });
  if (Object.keys(fields).length) return validationFailed(res, fields);

  const outcome = await Featured.create({ reportId, lguId: req.user.id, caption, photo: req.file });
  if (outcome.result === 'not_found') return res.status(404).json({ code: 'NOT_FOUND', message: 'Report not found.' });
  if (outcome.result === 'not_resolved') return res.status(409).json(NOT_RESOLVED);
  if (outcome.result === 'already_featured') {
    return res.status(409).json({ code: 'ALREADY_FEATURED', message: 'This report is already featured.' });
  }
  return res.status(201).json({ featured: forLgu(outcome.featured) });
}

/** PUT /api/admin/featured-cases/:id (multipart: caption, optional new photo) */
async function updateFeatured(req, res) {
  const id = readId(req.params.id);
  if (!id) return res.status(404).json(NOT_FOUND);
  const caption = cleanText(req.body?.caption);
  const captionError = checkCaption(caption);
  if (captionError) return validationFailed(res, { caption: captionError });

  const featured = await Featured.update(id, { caption, photo: req.file });
  if (!featured) return res.status(404).json(NOT_FOUND);
  return res.json({ featured: forLgu(featured) });
}

/** PATCH /api/admin/featured-cases/:id/visibility  { isVisible: true | false } */
async function setFeaturedVisibility(req, res) {
  const id = readId(req.params.id);
  if (!id) return res.status(404).json(NOT_FOUND);
  if (typeof req.body?.isVisible !== 'boolean') return validationFailed(res, { isVisible: 'INVALID_VALUE' });

  const outcome = await Featured.setVisible(id, req.body.isVisible);
  if (outcome.result === 'not_found') return res.status(404).json(NOT_FOUND);
  if (outcome.result === 'not_resolved') return res.status(409).json(NOT_RESOLVED);
  return res.json({ featured: forLgu(outcome.featured) });
}

/** PATCH /api/admin/featured-cases/:id/move  { direction: "up" | "down" } */
async function moveFeatured(req, res) {
  const id = readId(req.params.id);
  if (!id) return res.status(404).json(NOT_FOUND);
  const { direction } = req.body || {};
  if (direction !== 'up' && direction !== 'down') return validationFailed(res, { direction: 'INVALID_VALUE' });

  const cases = await Featured.move(id, direction);
  if (!cases) return res.status(404).json(NOT_FOUND);
  return res.json({ cases: cases.map(forLgu) });
}

/** DELETE /api/admin/featured-cases/:id - removes the case and its photo. */
async function removeFeatured(req, res) {
  const id = readId(req.params.id);
  if (!id || !(await Featured.remove(id))) return res.status(404).json(NOT_FOUND);
  return res.status(204).end();
}

/** GET /api/admin/featured-cases/:id/photo - the "after" photo (LGU, also hidden cases). */
async function getFeaturedPhotoForLgu(req, res) {
  const id = readId(req.params.id);
  const featured = id && (await Featured.findById(id));
  if (!featured) return res.status(404).json(NOT_FOUND);
  return sendPhoto(res, featured.photoPath, 'no-store');
}

/**
 * GET /api/public/resolved-cases (no login) - the landing page slideshow:
 * visible cases only, in order, max 10.
 */
async function listPublicCases(req, res) {
  const cases = await Featured.findPublic();
  return res.json({
    cases: cases.map((item) => ({
      caption: item.caption,
      issueType: item.issueType,
      area: item.area,
      dateResolved: item.dateResolved,
      photoUrl: `/api/public/resolved-cases/${item.id}/photo`,
    })),
  });
}

/** GET /api/public/resolved-cases/:id/photo (no login) - only while the case is shown publicly. */
async function getPublicPhoto(req, res) {
  const id = readId(req.params.id);
  const photoPath = id && (await Featured.findPublicPhotoPath(id));
  if (!photoPath) return res.status(404).json(NOT_FOUND);
  // "no-cache": the browser checks again each time, so a hidden or
  // removed case's photo is not shown from an old copy.
  return sendPhoto(res, photoPath, 'no-cache');
}

module.exports = {
  listFeatured,
  createFeatured,
  updateFeatured,
  setFeaturedVisibility,
  moveFeatured,
  removeFeatured,
  getFeaturedPhotoForLgu,
  listPublicCases,
  getPublicPhoto,
  forLgu,
};
