/**
 * Health check route.
 * GET /api/health -> tells us if the API is running and the database is reachable.
 */
const express = require('express');
const { checkConnection } = require('../config/db');

const router = express.Router();

router.get('/', async (req, res) => {
  const isConnected = await checkConnection();

  if (isConnected) {
    return res.json({ status: 'ok', database: 'connected' });
  }

  // 503 = "Service Unavailable": the API runs, but the database does not answer.
  return res.status(503).json({ status: 'error', database: 'disconnected' });
});

module.exports = router;
