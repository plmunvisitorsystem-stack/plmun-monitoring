/**
 * Database queries for the three account tables:
 * resident, response_team, and lgu.
 * All queries use "?" placeholders (parameterized) to prevent SQL injection.
 */
const { pool } = require('../config/db');

// How each role maps to its table. "name" is the display name for that role.
const ACCOUNT_TABLES = {
  resident: {
    table: 'resident',
    idColumn: 'resident_id',
    nameColumn: 'name',
    hasStatus: true,
  },
  response_team: {
    table: 'response_team',
    idColumn: 'team_id',
    nameColumn: 'team_name',
    hasStatus: false,
  },
  lgu: {
    table: 'lgu',
    idColumn: 'lgu_id',
    nameColumn: 'officer_in_charge',
    hasStatus: false,
  },
};

// Builds the SELECT for one role. Table and column names come from the fixed
// list above (never from the user), so it is safe to put them in the SQL text.
function selectAccountSql(role, whereColumn) {
  const t = ACCOUNT_TABLES[role];
  const status = t.hasStatus ? 'account_status' : "'Active'";
  return `SELECT ${t.idColumn} AS id, ${t.nameColumn} AS name, username,
                 password_hash AS passwordHash, ${status} AS accountStatus,
                 token_version AS tokenVersion
          FROM ${t.table} WHERE ${whereColumn} = ? LIMIT 1`;
}

/**
 * Looks for a username in resident, then response_team, then lgu.
 * Returns { role, id, name, username, passwordHash, accountStatus } or null.
 */
async function findByUsername(username) {
  for (const role of Object.keys(ACCOUNT_TABLES)) {
    const [rows] = await pool.execute(selectAccountSql(role, 'username'), [username]);
    if (rows.length > 0) {
      return { role, ...rows[0] };
    }
  }
  return null;
}

/**
 * Finds an account by role and id (used to check that a logged-in account
 * still exists and is still Active). Returns the account or null.
 */
async function findById(role, id) {
  const t = ACCOUNT_TABLES[role];
  if (!t) return null;
  const [rows] = await pool.execute(selectAccountSql(role, t.idColumn), [id]);
  return rows.length > 0 ? { role, ...rows[0] } : null;
}

/**
 * True if the username is already used in ANY of the three tables.
 * (Usernames must be unique across all account types.)
 */
async function usernameExists(username) {
  const [rows] = await pool.execute(
    `SELECT 1 FROM resident WHERE username = ?
     UNION ALL SELECT 1 FROM response_team WHERE username = ?
     UNION ALL SELECT 1 FROM lgu WHERE username = ?
     LIMIT 1`,
    [username, username, username],
  );
  return rows.length > 0;
}

/**
 * Inserts a new resident and returns the new resident_id.
 * consent_date records when the resident agreed to the Data Privacy Notice
 * (registration is refused without that agreement).
 */
async function createResident({ name, address, contactInfo, username, passwordHash }) {
  const [result] = await pool.execute(
    `INSERT INTO resident (name, address, contact_info, username, password_hash, consent_date)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [name, address, contactInfo, username, passwordHash],
  );
  return result.insertId;
}

/**
 * Makes every login token of this account invalid (logout, password change):
 * tokens carry the token_version they were made with, and the version goes up.
 * Returns the new version.
 */
async function revokeTokens(role, id) {
  const t = ACCOUNT_TABLES[role];
  await pool.execute(`UPDATE ${t.table} SET token_version = token_version + 1 WHERE ${t.idColumn} = ?`, [id]);
  const [rows] = await pool.execute(`SELECT token_version AS tokenVersion FROM ${t.table} WHERE ${t.idColumn} = ?`, [id]);
  return rows[0].tokenVersion;
}

// ----- Profiles -----
// The editable fields for each role: API name -> database column.
// The username is NOT here, so it can never be changed through the profile.
const PROFILE_FIELDS = {
  resident: { name: 'name', address: 'address', contactInfo: 'contact_info' },
  response_team: { teamName: 'team_name', assignedArea: 'assigned_area', contactInfo: 'contact_info' },
  lgu: { departmentName: 'department_name', officerInCharge: 'officer_in_charge', contactInfo: 'contact_info' },
};

/** The account's profile: { username, ...role fields }, or null. */
async function getProfile(role, id) {
  const t = ACCOUNT_TABLES[role];
  const fields = PROFILE_FIELDS[role];
  if (!t || !fields) return null;

  const columns = Object.entries(fields).map(([apiName, column]) => `${column} AS ${apiName}`).join(', ');
  const [rows] = await pool.execute(
    `SELECT username, ${columns} FROM ${t.table} WHERE ${t.idColumn} = ?`,
    [id],
  );
  return rows[0] || null;
}

/** Saves the role's profile fields for this account only. */
async function updateProfile(role, id, values) {
  const t = ACCOUNT_TABLES[role];
  const fields = PROFILE_FIELDS[role];
  const apiNames = Object.keys(fields);

  const setClause = apiNames.map((apiName) => `${fields[apiName]} = ?`).join(', ');
  await pool.execute(
    `UPDATE ${t.table} SET ${setClause} WHERE ${t.idColumn} = ?`,
    [...apiNames.map((apiName) => values[apiName]), id],
  );
}

/** Replaces the password hash of this account only. */
async function updatePassword(role, id, passwordHash) {
  const t = ACCOUNT_TABLES[role];
  await pool.execute(`UPDATE ${t.table} SET password_hash = ? WHERE ${t.idColumn} = ?`, [passwordHash, id]);
}

// ----- Administration (LGU) -----

/**
 * Residents and response teams in one list.
 *   filters: { role: 'resident' | 'response_team' | null, status: 'Active' | 'Inactive' | null, search }
 * Teams have no account status, so a status filter shows residents only.
 */
async function listUsers({ role, status, search }) {
  const parts = [];
  const params = [];
  // Escape % and _ so they are searched as normal characters.
  const like = search ? `%${search.replace(/[\\%_]/g, '\\$&')}%` : null;

  if (role !== 'response_team') {
    const where = [];
    if (status) {
      where.push('account_status = ?');
      params.push(status);
    }
    if (like) {
      where.push('(name LIKE ? OR username LIKE ?)');
      params.push(like, like);
    }
    parts.push(`SELECT 'resident' AS role, resident_id AS id, name, username, contact_info AS contactInfo,
                       account_status AS accountStatus, address AS details
                FROM resident ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`);
  }

  if (role !== 'resident' && !status) {
    const where = [];
    if (like) {
      where.push('(team_name LIKE ? OR username LIKE ?)');
      params.push(like, like);
    }
    parts.push(`SELECT 'response_team' AS role, team_id AS id, team_name AS name, username, contact_info AS contactInfo,
                       NULL AS accountStatus, assigned_area AS details
                FROM response_team ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`);
  }

  if (parts.length === 0) return [];
  const [rows] = await pool.execute(`${parts.join(' UNION ALL ')} ORDER BY role DESC, name`, params);
  return rows;
}

/** Adds a response team account and returns its new team_id. */
async function createTeam({ teamName, assignedArea, contactInfo, username, passwordHash }) {
  const [result] = await pool.execute(
    `INSERT INTO response_team (team_name, assigned_area, contact_info, username, password_hash)
     VALUES (?, ?, ?, ?, ?)`,
    [teamName, assignedArea, contactInfo, username, passwordHash],
  );
  return result.insertId;
}

/** Changes a resident's account status. Returns false if the resident does not exist. */
async function setResidentStatus(residentId, status) {
  const [result] = await pool.execute('UPDATE resident SET account_status = ? WHERE resident_id = ?', [status, residentId]);
  return result.affectedRows > 0;
}

/** All response teams (for the "Assign to team" dropdown). */
async function listTeams() {
  const [rows] = await pool.execute(
    'SELECT team_id AS id, team_name AS teamName, assigned_area AS assignedArea FROM response_team ORDER BY team_name',
  );
  return rows;
}

module.exports = {
  listTeams,
  listUsers,
  createTeam,
  setResidentStatus,
  PROFILE_FIELDS,
  findByUsername,
  findById,
  usernameExists,
  createResident,
  revokeTokens,
  getProfile,
  updateProfile,
  updatePassword,
};
