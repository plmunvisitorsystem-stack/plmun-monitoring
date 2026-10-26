/**
 * Entry point: loads settings from .env and starts the API server.
 */
// server/.env, also when started from the project root (npm start). On hosting
// the settings come from the platform's environment variables instead.
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env'), quiet: true });

// Login tokens cannot be made safely without a secret, so stop early.
const DEV_JWT_SECRET = 'change-this-to-a-long-random-string'; // the value in .env.example
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const jwtSecret = process.env.JWT_SECRET || '';
if (!jwtSecret || jwtSecret === DEV_JWT_SECRET) {
  console.error('JWT_SECRET is missing (or is the example value). Set it to a long random string and restart.');
  process.exit(1);
}
// On the live system the secret must also be long, so tokens cannot be guessed.
if (IS_PRODUCTION && jwtSecret.length < 32) {
  console.error('JWT_SECRET is too short for production (at least 32 characters). Set a long random string and restart.');
  process.exit(1);
}

const http = require('http');
const app = require('./app');
const { checkConnection, describeSsl } = require('./config/db');
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
  console.log(describeSsl());
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
