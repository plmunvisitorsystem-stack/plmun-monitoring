/**
 * Where report photos and featured "after" photos are kept.
 *
 *   local       (default)  server/uploads/<folder>/<random>.jpg|png
 *                          stored path: "reports/ab12....jpg"
 *   cloudinary  (when CLOUDINARY_URL is set in .env, e.g. on free hosting whose
 *                disk is wiped on every restart)
 *                          PRIVATE Cloudinary images; stored path:
 *                          "cloudinary:landayan/reports/ab12....jpg"
 *
 * Photos are never sent to browsers as Cloudinary links: the server reads the
 * photo after its own permission checks (photo.controller.js,
 * featured.controller.js) and sends the bytes, exactly like local files.
 * Both kinds of stored paths keep working, so old local photos are still served.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { UPLOAD_ROOT } = require('./uploads');

const CLOUD_PREFIX = 'cloudinary:';
const CLOUD_FOLDER = process.env.CLOUDINARY_FOLDER || 'landayan';
const useCloudinary = Boolean(process.env.CLOUDINARY_URL);
// Loaded only when used (the SDK reads CLOUDINARY_URL itself).
const cloudinary = useCloudinary ? require('cloudinary').v2 : null;

const CONTENT_TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };

/** "cloudinary:landayan/reports/ab12.jpg" -> { publicId: "landayan/reports/ab12", format: "jpg" } */
function parseCloudPath(stored) {
  const rest = stored.slice(CLOUD_PREFIX.length);
  const dot = rest.lastIndexOf('.');
  if (dot <= 0) return null;
  return { publicId: rest.slice(0, dot), format: rest.slice(dot + 1).toLowerCase() };
}

/** Full path of a local photo, only if it stays inside the uploads folder (no "../" tricks). */
function localFile(stored) {
  const fullPath = path.resolve(UPLOAD_ROOT, stored);
  return fullPath.startsWith(UPLOAD_ROOT + path.sep) ? fullPath : null;
}

/**
 * Saves a photo and returns its stored path.
 *   folder: 'reports' or 'featured';  ext: '.jpg' or '.png' (already checked)
 */
async function savePhoto(folder, buffer, ext) {
  const name = crypto.randomBytes(16).toString('hex');
  if (!useCloudinary) {
    await fs.promises.writeFile(path.join(UPLOAD_ROOT, folder, name + ext), buffer, { flag: 'wx' });
    return `${folder}/${name}${ext}`;
  }
  const result = await new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder: `${CLOUD_FOLDER}/${folder}`, public_id: name, type: 'private', resource_type: 'image', overwrite: false }, (error, uploaded) =>
        error ? reject(error) : resolve(uploaded),
      )
      .end(buffer);
  });
  return `${CLOUD_PREFIX}${result.public_id}.${result.format}`;
}

/** Reads a photo: { buffer, contentType }, or null if it does not exist. */
async function readPhoto(stored) {
  if (!stored) return null;
  if (stored.startsWith(CLOUD_PREFIX)) {
    const parsed = parseCloudPath(stored);
    if (!parsed || !cloudinary) return null;
    // A signed link that works for one minute, used only by this server.
    const url = cloudinary.utils.private_download_url(parsed.publicId, parsed.format, {
      type: 'private',
      resource_type: 'image',
      expires_at: Math.floor(Date.now() / 1000) + 60,
    });
    const response = await fetch(url);
    if (!response.ok) return null;
    return { buffer: Buffer.from(await response.arrayBuffer()), contentType: CONTENT_TYPES[`.${parsed.format}`] || 'application/octet-stream' };
  }
  const fullPath = localFile(stored);
  if (!fullPath) return null;
  try {
    return { buffer: await fs.promises.readFile(fullPath), contentType: CONTENT_TYPES[path.extname(fullPath).toLowerCase()] || 'application/octet-stream' };
  } catch {
    return null; // missing file
  }
}

/** Deletes a photo (errors are ignored: a missing photo is already "deleted"). */
async function deletePhoto(stored) {
  if (!stored) return;
  if (stored.startsWith(CLOUD_PREFIX)) {
    const parsed = parseCloudPath(stored);
    if (parsed && cloudinary) {
      await cloudinary.uploader.destroy(parsed.publicId, { type: 'private', resource_type: 'image', invalidate: true }).catch(() => {});
    }
    return;
  }
  const fullPath = localFile(stored);
  if (fullPath) await fs.promises.unlink(fullPath).catch(() => {});
}

/** Sends a photo with headers that stop browsers from caching or guessing its type. */
async function sendPhoto(res, stored, cacheControl, notFoundBody) {
  const photo = await readPhoto(stored);
  if (!photo) return res.status(404).json(notFoundBody);
  res.set('Cache-Control', cacheControl);
  res.set('X-Content-Type-Options', 'nosniff');
  return res.type(photo.contentType).send(photo.buffer);
}

const STORAGE_MODE = useCloudinary ? 'cloudinary' : 'local';

module.exports = { STORAGE_MODE, savePhoto, readPhoto, deletePhoto, sendPhoto, parseCloudPath, localFile };
