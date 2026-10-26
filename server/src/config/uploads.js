/**
 * Where uploaded files are stored on the server.
 *   <UPLOAD_ROOT>/reports/<random name>.jpg|png   (residents' report photos)
 *   <UPLOAD_ROOT>/featured/<random name>.jpg|png  (LGU "after" photos of featured cases)
 * UPLOAD_ROOT is UPLOAD_DIR from .env, or server/uploads when it is not set.
 * On hosting, set UPLOAD_DIR to a persistent volume (e.g. /data/uploads on
 * Railway) so photos are not lost when the server restarts or is redeployed.
 * The database stores the path relative to UPLOAD_ROOT ("reports/ab12....jpg"),
 * so the folder can be moved without changing the database.
 * The folders are created automatically when the server starts.
 */
const fs = require('fs');
const path = require('path');

const UPLOAD_ROOT = process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : path.resolve(__dirname, '../../uploads');
const REPORT_PHOTO_DIR = path.join(UPLOAD_ROOT, 'reports');
const FEATURED_PHOTO_DIR = path.join(UPLOAD_ROOT, 'featured');

fs.mkdirSync(REPORT_PHOTO_DIR, { recursive: true });
fs.mkdirSync(FEATURED_PHOTO_DIR, { recursive: true });

module.exports = { UPLOAD_ROOT, REPORT_PHOTO_DIR, FEATURED_PHOTO_DIR };
