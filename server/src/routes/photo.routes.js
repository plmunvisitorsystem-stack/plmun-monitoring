/**
 * Photo routes (mounted at /api/photos in app.js, which requires a valid
 * login token for any role; the controller checks who may see each photo):
 *   GET /api/photos/:id
 */
const express = require('express');
const { getPhoto } = require('../controllers/photo.controller');

const router = express.Router();

router.get('/:id', getPhoto);

module.exports = router;
