/**
 * Account routes:
 *   POST /api/auth/register  - create a resident account (public; Data Privacy consent required)
 *   POST /api/auth/login     - log in, returns a JWT (public)
 *   GET  /api/auth/me        - the logged-in account (any role)
 *   POST /api/auth/logout    - log out: this account's tokens stop working (any role)
 */
const express = require('express');
const { register, login, me, logout } = require('../controllers/auth.controller');
const { requireAuth, requireRole, ALL_ROLES } = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', requireAuth, requireRole(...ALL_ROLES), me);
router.post('/logout', requireAuth, requireRole(...ALL_ROLES), logout);

module.exports = router;
