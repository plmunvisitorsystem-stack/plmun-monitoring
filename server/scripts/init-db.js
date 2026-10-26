/**
 * Creates the database tables on a database without phpMyAdmin (e.g. Aiven
 * cloud MySQL), using the DB_* settings (including DB_SSL) from server/.env,
 * or from another file:  node --env-file=.env.production scripts/init-db.js --seed
 *
 *   npm run init-db                 -> database/schema.sql (all tables)
 *   npm run init-db -- --seed       -> schema.sql + seed.sql (test accounts and sample reports)
 *   add --force                     -> allowed even if the database already has tables
 *
 * WARNING: schema.sql DELETES every table and all data. Without --force the
 * script stops if the database already has tables.
 * seed.sql is test data only (shared password Password123!): never use it for real residents.
 */
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { sslOptions } = require('../src/config/db');

const args = process.argv.slice(2);
const withSeed = args.includes('--seed');
const force = args.includes('--force');
const DB_NAME = process.env.DB_NAME || 'landayan_ers';
const DATABASE_DIR = path.resolve(__dirname, '../../database');

// The SQL files name the database "landayan_ers"; use DB_NAME instead.
const readSql = (file) => fs.readFileSync(path.join(DATABASE_DIR, file), 'utf8').replace(/landayan_ers/g, DB_NAME);

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    ssl: sslOptions(), // same SSL settings as the app (DB_SSL, DB_SSL_CA / DB_SSL_CA_FILE)
    multipleStatements: true,
  });
  // Same time zone as the app (seed dates are relative to "now" in Manila).
  await connection.query('SET time_zone = ?', [process.env.DB_TIME_ZONE || '+08:00']);

  const [tables] = await connection.query('SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = ?', [DB_NAME]);
  if (tables[0].n > 0 && !force) {
    console.error(`Database "${DB_NAME}" already has ${tables[0].n} tables. schema.sql would DELETE all of them and their data.`);
    console.error('Stopped. To really replace everything, run again with --force.');
    await connection.end();
    process.exit(1);
  }

  console.log(`Creating the tables in "${DB_NAME}" on ${process.env.DB_HOST || 'localhost'} ...`);
  await connection.query(readSql('schema.sql'));
  if (withSeed) {
    console.log('Adding the test accounts and sample reports (seed.sql) ...');
    await connection.query(readSql('seed.sql'));
  }
  const [rows] = await connection.query(
    `SELECT (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = ?) AS tables,
            (SELECT COUNT(*) FROM \`${DB_NAME}\`.report) AS reports`,
    [DB_NAME],
  );
  console.log(`Done: ${rows[0].tables} tables, ${rows[0].reports} reports.`);
  await connection.end();
}

main().catch((error) => {
  console.error('Database setup failed:', error.message);
  process.exit(1);
});
