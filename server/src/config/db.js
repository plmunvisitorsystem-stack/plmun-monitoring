/**
 * MySQL connection module.
 *
 * We use a connection POOL instead of a single connection. A pool keeps a few
 * connections open and reuses them, so many requests can run at the same time
 * and a dropped connection does not crash the server.
 *
 * Always use parameterized queries with this pool, for example:
 *   const [rows] = await pool.execute('SELECT * FROM resident WHERE username = ?', [username]);
 * The "?" placeholders protect the database from SQL injection.
 */
const fs = require('fs');
const mysql = require('mysql2/promise');

/**
 * Encrypted connection for cloud MySQL (e.g. Aiven), set in .env:
 *   DB_SSL=true        -> use SSL
 *   DB_SSL_CA=...      -> the provider's CA certificate (PEM text, "\n" allowed), or
 *   DB_SSL_CA_FILE=... -> the path of the downloaded ca.pem file,
 *                         so the server's identity is checked; without either the
 *                         connection is still encrypted but not verified.
 * Local XAMPP needs none of these.
 */
function sslOptions() {
  if (process.env.DB_SSL !== 'true') return undefined;
  let ca;
  if (process.env.DB_SSL_CA) ca = normalizePem(process.env.DB_SSL_CA);
  else if (process.env.DB_SSL_CA_FILE) ca = normalizePem(fs.readFileSync(process.env.DB_SSL_CA_FILE, 'utf8'));
  return ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false };
}

/**
 * Rebuilds a certificate pasted into a hosting dashboard, where line breaks
 * often become spaces, "\r\n", or the two characters "\n". Each
 * BEGIN/END CERTIFICATE block is re-wrapped in the standard 64-character lines.
 */
function normalizePem(text) {
  const blocks = [...String(text).replace(/\\n/g, '\n').matchAll(/-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/g)];
  if (blocks.length === 0) return String(text);
  return blocks
    .map(([, body]) => {
      const base64 = body.replace(/[^A-Za-z0-9+/=]/g, '');
      return `-----BEGIN CERTIFICATE-----\n${base64.match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----\n`;
    })
    .join('');
}

// Dates are stored in Barangay Landayan time. Cloud databases usually run on
// UTC, so every connection uses Philippine time (UTC+8, no daylight saving)
// for NOW(), CURDATE() and DEFAULT CURRENT_TIMESTAMP.
const DB_TIME_ZONE = process.env.DB_TIME_ZONE || '+08:00';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'landayan_ers',
  ssl: sslOptions(),
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
  // Return DATETIME columns as plain strings ("2026-03-14 09:30:00")
  // so dates are not shifted by time zone conversion.
  dateStrings: true,
});

// Runs once for every new connection in the pool. The command is queued
// before any other query on that connection, so every query sees this zone.
pool.pool.on('connection', (connection) => {
  connection.query('SET time_zone = ?', [DB_TIME_ZONE], (error) => {
    if (error) console.error('Could not set the database time zone:', error.message);
  });
});

/**
 * Checks that the database can be reached by running a tiny query.
 * Returns true if connected, false otherwise (never throws).
 */
async function checkConnection() {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database connection failed:', error.message);
    return false;
  }
}

module.exports = { pool, checkConnection, sslOptions, normalizePem };
