/**
 * Database queries for Featured Resolved Cases (table featured_case):
 * resolved reports the LGU shows in the public landing page slideshow.
 *
 * Only Resolved reports can be featured. If a featured report is somehow
 * no longer Resolved (e.g. changed directly in the database), hideUnresolved()
 * sets it to hidden; it runs before every list, so the slideshow never
 * shows it.
 */
const { pool } = require('../config/db');
const PhotoStorage = require('../config/photoStorage');

// The report has no "date resolved" column: it is the date of the
// "... is now Resolved." notification (or, for older data, the report's
// latest notification).
const DATE_RESOLVED = `COALESCE(
    (SELECT MAX(n.date_sent) FROM notification n
     WHERE n.report_id = r.report_id
       AND (n.message LIKE '% is now Resolved.' OR n.message = 'Your report has been resolved.')),
    (SELECT MAX(n.date_sent) FROM notification n WHERE n.report_id = r.report_id))`;

const PUBLIC_LIMIT = 10;

// Never the resident: only what the LGU and the public need.
const COLUMNS = `f.featured_id AS id, f.report_id AS reportId, r.date_submitted AS dateSubmitted,
       f.caption, f.display_order AS displayOrder, f.is_visible AS isVisible,
       f.date_featured AS dateFeatured, r.issue_type AS issueType, r.area,
       r.status, ${DATE_RESOLVED} AS dateResolved`;

const toCase = (row) => ({ ...row, isVisible: Boolean(row.isVisible) });

async function hideUnresolved(db = pool) {
  await db.execute(
    `UPDATE featured_case f JOIN report r ON r.report_id = f.report_id
     SET f.is_visible = 0 WHERE f.is_visible = 1 AND r.status <> 'Resolved'`,
  );
}

/** All featured cases for the LGU page, in slideshow order. */
async function findAll() {
  await hideUnresolved();
  const [rows] = await pool.execute(
    `SELECT ${COLUMNS} FROM featured_case f JOIN report r ON r.report_id = f.report_id
     ORDER BY f.display_order, f.featured_id`,
  );
  return rows.map(toCase);
}

/** One featured case, or null. */
async function findById(id, db = pool) {
  const [rows] = await db.execute(
    `SELECT ${COLUMNS}, f.after_photo_path AS photoPath
     FROM featured_case f JOIN report r ON r.report_id = f.report_id WHERE f.featured_id = ?`,
    [id],
  );
  return rows[0] ? toCase(rows[0]) : null;
}

/** The featured case of a report (for the LGU Report Details page), or null. */
async function findByReport(reportId) {
  const [rows] = await pool.execute('SELECT featured_id AS id FROM featured_case WHERE report_id = ?', [reportId]);
  return rows[0] ? findById(rows[0].id) : null;
}

/** The date a report was resolved (shown on its slide), or null. */
async function findDateResolved(reportId) {
  const [rows] = await pool.execute(`SELECT ${DATE_RESOLVED} AS dateResolved FROM report r WHERE r.report_id = ? AND r.status = 'Resolved'`, [reportId]);
  return rows[0] ? rows[0].dateResolved : null;
}

/**
 * The public slideshow: visible cases of Resolved reports, in order, max 10.
 * Only the caption, issue type, area, date resolved and the "after" photo.
 */
async function findPublic() {
  await hideUnresolved();
  const [rows] = await pool.execute(
    `SELECT f.featured_id AS id, f.caption, r.issue_type AS issueType, r.area, ${DATE_RESOLVED} AS dateResolved
     FROM featured_case f JOIN report r ON r.report_id = f.report_id
     WHERE f.is_visible = 1 AND r.status = 'Resolved'
     ORDER BY f.display_order, f.featured_id
     LIMIT ${PUBLIC_LIMIT}`,
  );
  return rows;
}

/** The file of a publicly shown case (visible + Resolved), or null. */
async function findPublicPhotoPath(id) {
  const [rows] = await pool.execute(
    `SELECT f.after_photo_path AS photoPath
     FROM featured_case f JOIN report r ON r.report_id = f.report_id
     WHERE f.featured_id = ? AND f.is_visible = 1 AND r.status = 'Resolved'`,
    [id],
  );
  return rows[0] ? rows[0].photoPath : null;
}

// The "after" photo: on the server disk or in Cloudinary (config/photoStorage.js).
async function writePhoto(photo) {
  return PhotoStorage.savePhoto('featured', photo.buffer, photo.detected.ext);
}

async function deletePhoto(photoPath) {
  await PhotoStorage.deletePhoto(photoPath);
}

/**
 * Features a Resolved report (added at the end of the slideshow).
 * Returns { result: 'created', featured } or { result: 'not_found' | 'not_resolved' | 'already_featured' }.
 */
async function create({ reportId, lguId, caption, photo }) {
  const connection = await pool.getConnection();
  let photoPath = null;
  try {
    await connection.beginTransaction();
    const [reports] = await connection.execute('SELECT status FROM report WHERE report_id = ? FOR UPDATE', [reportId]);
    let problem = null;
    if (!reports.length) problem = 'not_found';
    else if (reports[0].status !== 'Resolved') problem = 'not_resolved';
    else {
      const [existing] = await connection.execute('SELECT 1 FROM featured_case WHERE report_id = ?', [reportId]);
      if (existing.length) problem = 'already_featured';
    }
    if (problem) {
      await connection.rollback();
      return { result: problem };
    }

    photoPath = await writePhoto(photo);
    const [result] = await connection.execute(
      `INSERT INTO featured_case (report_id, caption, after_photo_path, display_order, is_visible, date_featured, lgu_id)
       SELECT ?, ?, ?, COALESCE(MAX(display_order), 0) + 1, 1, NOW(), ? FROM featured_case`,
      [reportId, caption, photoPath, lguId],
    );
    await connection.commit();
    return { result: 'created', featured: await findById(result.insertId) };
  } catch (error) {
    await connection.rollback();
    await deletePhoto(photoPath);
    // Two LGU users featuring the same report at the same moment.
    if (error.code === 'ER_DUP_ENTRY') return { result: 'already_featured' };
    throw error;
  } finally {
    connection.release();
  }
}

/** New caption and (optionally) a new photo. Returns the case or null. */
async function update(id, { caption, photo }) {
  const current = await findById(id);
  if (!current) return null;
  const newPath = photo ? await writePhoto(photo) : null;
  try {
    await pool.execute('UPDATE featured_case SET caption = ?, after_photo_path = COALESCE(?, after_photo_path) WHERE featured_id = ?', [caption, newPath, id]);
  } catch (error) {
    await deletePhoto(newPath);
    throw error;
  }
  if (newPath) await deletePhoto(current.photoPath);
  return findById(id);
}

/**
 * Visible / Hidden. A case of a report that is not Resolved cannot be shown.
 * Returns { result: 'saved', featured } or { result: 'not_found' | 'not_resolved' }.
 */
async function setVisible(id, visible) {
  const current = await findById(id);
  if (!current) return { result: 'not_found' };
  if (visible && current.status !== 'Resolved') return { result: 'not_resolved' };
  await pool.execute('UPDATE featured_case SET is_visible = ? WHERE featured_id = ?', [visible ? 1 : 0, id]);
  return { result: 'saved', featured: await findById(id) };
}

/**
 * Moves a case one place up or down in the slideshow (swaps with its
 * neighbour). The order is first renumbered 1, 2, 3... so it has no gaps.
 * Returns the new list, or null if the case does not exist.
 */
async function move(id, direction) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute('SELECT featured_id AS id FROM featured_case ORDER BY display_order, featured_id FOR UPDATE');
    const ids = rows.map((row) => row.id);
    const index = ids.indexOf(id);
    if (index === -1) {
      await connection.rollback();
      return null;
    }
    const other = direction === 'up' ? index - 1 : index + 1;
    if (other >= 0 && other < ids.length) [ids[index], ids[other]] = [ids[other], ids[index]];
    for (const [position, featuredId] of ids.entries()) {
      await connection.execute('UPDATE featured_case SET display_order = ? WHERE featured_id = ?', [position + 1, featuredId]);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return findAll();
}

/** Removes a case and its photo. Returns false if it does not exist. */
async function remove(id) {
  const current = await findById(id);
  if (!current) return false;
  await pool.execute('DELETE FROM featured_case WHERE featured_id = ?', [id]);
  await deletePhoto(current.photoPath);
  return true;
}

module.exports = {
  findAll,
  findById,
  findByReport,
  findDateResolved,
  findPublic,
  findPublicPhotoPath,
  create,
  update,
  setVisible,
  move,
  remove,
};
