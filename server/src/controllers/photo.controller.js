/**
 * GET /api/photos/:id - sends one report photo.
 * Allowed: the resident who owns the report, the response team assigned to
 * it, and the LGU. Everyone else gets 403.
 * The photo comes from the server disk or Cloudinary (config/photoStorage.js);
 * either way it is only sent after this check.
 */
const Photo = require('../models/photo.model');
const PhotoStorage = require('../config/photoStorage');

const NOT_FOUND = { code: 'NOT_FOUND', message: 'Photo not found.' };

function canSee(user, photo) {
  if (user.role === 'lgu') return true;
  if (user.role === 'resident') return photo.residentId === user.id;
  if (user.role === 'response_team') return photo.teamId === user.id;
  return false;
}

async function getPhoto(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(404).json(NOT_FOUND);

  const photo = await Photo.findWithReport(id);
  if (!photo) return res.status(404).json(NOT_FOUND);
  if (!canSee(req.user, photo)) {
    return res.status(403).json({ code: 'FORBIDDEN', message: 'You cannot view this photo.' });
  }

  // "no-store": the browser must not keep a copy. Otherwise, on a shared
  // phone, the next person who logs in could get this photo from the
  // browser's cache without the permission check above.
  return PhotoStorage.sendPhoto(res, photo.filePath, 'no-store', NOT_FOUND);
}

module.exports = { getPhoto };
