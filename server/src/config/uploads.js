/**
 * Where uploaded files are stored on the server.
 *   server/uploads/reports/<random name>.jpg|png   (residents' report photos)
 *   server/uploads/featured/<random name>.jpg|png  (LGU "after" photos of featured cases)
 * The database stores the path relative to UPLOAD_ROOT ("reports/ab12....jpg").
 * The folders are created automatically when the server starts.
 */
const fs = require('fs');
const path = require('path');

const UPLOAD_ROOT = path.resolve(__dirname, '../../uploads');
const REPORT_PHOTO_DIR = path.join(UPLOAD_ROOT, 'reports');
const FEATURED_PHOTO_DIR = path.join(UPLOAD_ROOT, 'featured');

fs.mkdirSync(REPORT_PHOTO_DIR, { recursive: true });
fs.mkdirSync(FEATURED_PHOTO_DIR, { recursive: true });

module.exports = { UPLOAD_ROOT, REPORT_PHOTO_DIR, FEATURED_PHOTO_DIR };
