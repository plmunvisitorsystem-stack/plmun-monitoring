/**
 * Profile management for all three roles.
 * The account is ALWAYS taken from the login token (req.user), never from
 * the request body, so each account can only read and edit its own profile.
 */
const bcrypt = require('bcrypt');
const Account = require('../models/account.model');
const { signToken } = require('../utils/token');
const { validateProfile, validatePasswordChange } = require('../utils/validators');

const SALT_ROUNDS = 10;

/** GET /api/profile - the logged-in account's profile. */
async function getProfile(req, res) {
  const profile = await Account.getProfile(req.user.role, req.user.id);
  if (!profile) {
    return res.status(404).json({ code: 'NOT_FOUND', message: 'Account not found.' });
  }
  return res.json({ role: req.user.role, profile });
}

/**
 * PUT /api/profile - saves the role's fields.
 * Returns the saved profile and the updated user (the display name may change).
 */
async function updateProfile(req, res) {
  const { role, id } = req.user;
  const { values, errors } = validateProfile(role, req.body || {});

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ code: 'VALIDATION_FAILED', message: 'Please correct the highlighted fields.', fields: errors });
  }

  await Account.updateProfile(role, id, values);
  const profile = await Account.getProfile(role, id);
  const account = await Account.findById(role, id);

  return res.json({
    role,
    profile,
    user: { id: account.id, role, name: account.name, username: account.username },
  });
}

/** PUT /api/profile/password - changes the password (current password required). */
async function changePassword(req, res) {
  const { role, id } = req.user;
  const { values, errors } = validatePasswordChange(req.body || {});

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ code: 'VALIDATION_FAILED', message: 'Please correct the highlighted fields.', fields: errors });
  }

  // req.account was loaded by requireAuth and includes the password hash.
  const matches = await bcrypt.compare(values.currentPassword, req.account.passwordHash);
  if (!matches) {
    return res.status(400).json({
      code: 'WRONG_CURRENT_PASSWORD',
      message: 'The current password is incorrect.',
      fields: { currentPassword: 'WRONG_CURRENT_PASSWORD' },
    });
  }

  const passwordHash = await bcrypt.hash(values.newPassword, SALT_ROUNDS);
  await Account.updatePassword(role, id, passwordHash);
  // Every older token stops working (e.g. a session left open on another phone);
  // this tab gets a new token so it stays logged in.
  const tokenVersion = await Account.revokeTokens(role, id);
  return res.json({ code: 'PASSWORD_CHANGED', message: 'Password changed.', token: signToken({ id, role, tokenVersion }) });
}

module.exports = { getProfile, updateProfile, changePassword };
