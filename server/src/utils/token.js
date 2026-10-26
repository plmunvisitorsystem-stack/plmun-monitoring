/**
 * Login tokens (JWT). A token carries { id, role, tv }: tv is the account's
 * token_version when the token was made. Logout and password change raise
 * token_version, so older tokens stop working (checked in middleware/auth.js
 * for the REST API and Socket.IO).
 */
const jwt = require('jsonwebtoken');

function signToken({ id, role, tokenVersion }) {
  return jwt.sign({ id, role, tv: tokenVersion }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
}

module.exports = { signToken };
