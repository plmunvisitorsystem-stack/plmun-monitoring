/**
 * Accepts up to MAX_PHOTOS report photos (field name "photos"), each up to
 * MAX_PHOTO_MB, as multipart/form-data. Files are kept in memory here; they
 * are checked and written to disk only when the report is saved.
 *
 * The real file type is checked from the first bytes of the file (its
 * "magic number"), not from the name or the type the browser claims, so a
 * PDF renamed to .jpg is still rejected.
 *
 * Errors are answered as JSON with a code the client translates:
 *   TOO_MANY_PHOTOS, PHOTO_TOO_LARGE, INVALID_PHOTO_TYPE
 */
const multer = require('multer');
const RULES = require('../../config/rules');

const MAX_BYTES = RULES.MAX_PHOTO_MB * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_BYTES,
    files: RULES.MAX_PHOTOS,
    fields: 10, // issueType, area, location, description (+ room for extras)
    fieldSize: 10 * 1024, // 10 KB per text field
  },
}).array('photos', RULES.MAX_PHOTOS);

// JPG files start with FF D8 FF; PNG files start with 89 50 4E 47 0D 0A 1A 0A.
function detectImageType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { ext: '.jpg', mime: 'image/jpeg' };
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buffer.length >= 8 && png.every((byte, i) => buffer[i] === byte)) return { ext: '.png', mime: 'image/png' };
  return null;
}

function photoError(res, code, message) {
  return res.status(400).json({
    code,
    message,
    fields: { photos: code },
    limits: { maxPhotos: RULES.MAX_PHOTOS, maxPhotoMb: RULES.MAX_PHOTO_MB },
  });
}

/** Express middleware: runs multer, then checks every file's real type. */
function uploadPhotos(req, res, next) {
  upload(req, res, (error) => {
    if (error) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return photoError(res, 'PHOTO_TOO_LARGE', `Each photo must be ${RULES.MAX_PHOTO_MB} MB or smaller.`);
      }
      if (error.code === 'LIMIT_FILE_COUNT' || (error.code === 'LIMIT_UNEXPECTED_FILE' && error.field === 'photos')) {
        return photoError(res, 'TOO_MANY_PHOTOS', `You can add up to ${RULES.MAX_PHOTOS} photos only.`);
      }
      if (error instanceof multer.MulterError) {
        return res.status(400).json({ code: 'VALIDATION_FAILED', message: 'The upload could not be read.' });
      }
      return next(error);
    }

    for (const file of req.files || []) {
      const type = detectImageType(file.buffer);
      if (!type) return photoError(res, 'INVALID_PHOTO_TYPE', 'Only JPG and PNG photos are allowed.');
      file.detected = type; // used when the file is saved
    }
    return next();
  });
}

// One photo (field name "photo"), same size and type rules as report photos.
// Used for the "after" photo of a featured case. Text fields: caption.
const uploadOne = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1, fields: 5, fieldSize: 10 * 1024 },
}).single('photo');

function onePhotoError(res, code, message) {
  return res.status(400).json({ code, message, fields: { photo: code }, limits: { maxPhotoMb: RULES.MAX_PHOTO_MB } });
}

/** Express middleware: runs multer for ONE photo, then checks its real type. */
function uploadOnePhoto(req, res, next) {
  uploadOne(req, res, (error) => {
    if (error) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return onePhotoError(res, 'PHOTO_TOO_LARGE', `The photo must be ${RULES.MAX_PHOTO_MB} MB or smaller.`);
      }
      if (error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE') {
        return onePhotoError(res, 'ONE_PHOTO_ONLY', 'Add only one photo.');
      }
      if (error instanceof multer.MulterError) {
        return res.status(400).json({ code: 'VALIDATION_FAILED', message: 'The upload could not be read.' });
      }
      return next(error);
    }

    if (req.file) {
      const type = detectImageType(req.file.buffer);
      if (!type) return onePhotoError(res, 'INVALID_PHOTO_TYPE', 'Only JPG and PNG photos are allowed.');
      req.file.detected = type;
    }
    return next();
  });
}

module.exports = { uploadPhotos, uploadOnePhoto, detectImageType };
