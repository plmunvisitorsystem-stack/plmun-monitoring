/**
 * Route protection.
 *
 *   requireAuth            -> the request must have a valid login token
 *   requireRole('lgu')     -> the logged-in account must have one of these roles
 *
 * Example:  router.get('/users', requireAuth, requireRole('lgu'), listUsers);
 */
const jwt = require('jsonwebtoken');
const Account = require('../models/account.model');

const ROLES = ['resident', 'response_team', 'lgu'];

/**
 * Checks a login token: valid signature, not expired, the account still
 * exists, the token's version (tv) matches the account's token_version
 * (not logged out since), and the account is Active. Used by requireAuth (REST API) and by the Socket.IO
 * connection (src/realtime/socket.js), so both follow the same rules.
 * Returns { user: { id, role }, account } or { error: { status, code, message } }.
 */
async function authenticateToken(token) {
  if (!token) return { error: { status: 401, code: 'UNAUTHORIZED', message: 'Please log in.' } };

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (error) {
    const code = error.name === 'TokenExpiredError' ? 'SESSION_EXPIRED' : 'UNAUTHORIZED';
    return { error: { status: 401, code, message: 'Invalid or expired token.' } };
  }

  if (!ROLES.includes(payload.role) || !Number.isInteger(payload.id)) {
    return { error: { status: 401, code: 'UNAUTHORIZED', message: 'Invalid token.' } };
  }

  // The account may have been deactivated or removed after the token was made.
  const account = await Account.findById(payload.role, payload.id);
  if (!account) {
    return { error: { status: 401, code: 'UNAUTHORIZED', message: 'Account not found.' } };
  }
  // Logout and password change raise token_version: older tokens are no longer accepted.
  if (payload.tv !== account.tokenVersion) {
    return { error: { status: 401, code: 'SESSION_EXPIRED', message: 'This session has ended. Please log in again.' } };
  }
  if (account.accountStatus !== 'Active') {
    return { error: { status: 403, code: 'ACCOUNT_INACTIVE', message: 'This account is inactive.' } };
  }

  return { user: { id: payload.id, role: payload.role }, account };
}

/**
 * Reads "Authorization: Bearer <token>" and checks it with authenticateToken.
 * Sets req.user = { id, role } and req.account = the account row.
 */
async function requireAuth(req, res, next) {
  const header = req.get('Authorization') || '';
  const [scheme, token] = header.split(' ');
  const result = await authenticateToken(scheme === 'Bearer' ? token : '');

  if (result.error) {
    const { status, code, message } = result.error;
    return res.status(status).json({ code, message });
  }

  req.user = result.user;
  req.account = result.account;
  return next();
}

/** Allows only the listed roles. Must run after requireAuth. */
function requireRole(...allowedRoles) {
  return function checkRole(req, res, next) {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'You do not have access to this resource.' });
    }
    return next();
  };
}

// Every account type, for routes that all logged-in users may use (e.g. Profile).
const ALL_ROLES = ROLES;

module.exports = { authenticateToken, requireAuth, requireRole, ALL_ROLES };
