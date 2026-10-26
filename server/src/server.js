/**
 * Entry point: loads settings from .env and starts the API server.
 */
require('dotenv').config({ quiet: true });

// Login tokens cannot be made safely without a secret, so stop early.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-this-to-a-long-random-string') {
  console.error('JWT_SECRET is missing in server/.env. Set it to a long random string and restart.');
  process.exit(1);
}

const http = require('http');
const app = require('./app');
const { checkConnection } = require('./config/db');
const { attachSocket } = require('./realtime/socket');
const HOTLINES = require('../config/hotlines');
const { hotlineWarnings } = require('../services/publicInfo');

const PORT = Number(process.env.PORT) || 5000;

// One HTTP server for both the REST API (Express) and real-time chat (Socket.IO).
const server = http.createServer(app);
attachSocket(server);

server.listen(PORT, async () => {
  console.log(`API server running at http://localhost:${PORT}`);

  // Show the database status on startup so problems are easy to spot.
  const isConnected = await checkConnection();
  console.log(isConnected
    ? 'Database: connected'
    : 'Database: NOT connected - is MySQL running in XAMPP and was schema.sql imported?');

  // Hotlines that residents may call in an emergency must be real and checked.
  const warnings = hotlineWarnings(HOTLINES);
  if (warnings.length > 0) {
    console.warn(`WARNING: ${warnings.length} emergency hotline(s) in server/config/hotlines.js need checking:`);
    warnings.forEach((line) => console.warn(`  - ${line}`));
  }
});

// Log unexpected errors instead of letting the process die silently.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});
