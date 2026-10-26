/**
 * Account management: register (residents only), login, "who am I", and logout.
 * Logout raises the account's token_version, so its old tokens stop working.
 *
 * Errors are sent as { code, message }. The client shows the translated
 * text for the code; message is English for developers and logs.
 *
 * Express 5 passes errors from async functions to the error handler
 * automatically, so a database error returns 500 instead of crashing.
 */
const bcrypt = require('bcrypt');
const Account = require('../models/account.model');
const Realtime = require('../realtime/socket');
const { signToken } = require('../utils/token');
const { cleanText, validateRegistration } = require('../utils/validators');

const SALT_ROUNDS = 10;

// A real bcrypt hash of a random string. When a username does not exist we
// still compare against this, so a wrong username takes as long as a wrong
// password and attackers cannot tell which usernames exist.
const DUMMY_HASH = '$2b$10$wnl0Sso2O8qM4t87Nn33f.qcH9S0hbtQGR0QP.8NOn/gfoQFOqwWu';

// Shape of the user object sent to the client (never includes the hash).
function publicUser(account) {
  return {
    id: account.id,
    role: account.role,
    name: account.name,
    username: account.username,
  };
}

/** POST /api/auth/register - creates a resident account. */
async function register(req, res) {
  const { values, errors } = validateRegistration(req.body || {});

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ code: 'VALIDATION_FAILED', message: 'Please correct the highlighted fields.', fields: errors });
  }

  if (await Account.usernameExists(values.username)) {
    return res.status(409).json({ code: 'USERNAME_TAKEN', message: 'This username is already taken.', fields: { username: 'USERNAME_TAKEN' } });
  }

  const passwordHash = await bcrypt.hash(values.password, SALT_ROUNDS);

  try {
    await Account.createResident({ ...values, passwordHash });
  } catch (error) {
    // Two people registering the same username at the same moment:
    // the UNIQUE index catches the second one.
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ code: 'USERNAME_TAKEN', message: 'This username is already taken.', fields: { username: 'USERNAME_TAKEN' } });
    }
    throw error;
  }

  return res.status(201).json({ code: 'REGISTERED', message: 'Account created. You can now log in.' });
}

/** POST /api/auth/login - checks username + password and returns a JWT. */
async function login(req, res) {
  const body = req.body || {};
  const username = cleanText(body.username);
  const password = typeof body.password === 'string' ? body.password : '';

  const fields = {};
  if (!username) fields.username = 'FIELD_REQUIRED';
  if (!password) fields.password = 'FIELD_REQUIRED';
  if (Object.keys(fields).length > 0) {
    return res.status(400).json({ code: 'VALIDATION_FAILED', message: 'Username and password are required.', fields });
  }

  const account = await Account.findByUsername(username);
  const passwordMatches = await bcrypt.compare(password, account ? account.passwordHash : DUMMY_HASH);

  if (!account || !passwordMatches) {
    return res.status(401).json({ code: 'INVALID_CREDENTIALS', message: 'Wrong username or password.' });
  }

  // Checked only after the password is correct, so the status is not
  // revealed to someone guessing passwords.
  if (account.accountStatus !== 'Active') {
    return res.status(403).json({ code: 'ACCOUNT_INACTIVE', message: 'This account is inactive.' });
  }

  // The token carries the id, role, and token version. It expires after JWT_EXPIRES_IN.
  const token = signToken(account);

  return res.json({ token, user: publicUser(account) });
}

/** GET /api/auth/me - returns the logged-in account (requireAuth runs first). */
async function me(req, res) {
  return res.json({ user: publicUser(req.account) });
}

/**
 * POST /api/auth/logout - ends every session of this account: the token
 * version goes up, so this token (and any other copy of it) no longer works,
 * and the account's live chat connections are closed.
 */
async function logout(req, res) {
  await Account.revokeTokens(req.user.role, req.user.id);
  Realtime.disconnectUser(req.user.role, req.user.id);
  return res.json({ code: 'LOGGED_OUT', message: 'Logged out.' });
}

module.exports = { register, login, me, logout };
