/**
 * Sets up or upgrades the database, safely. Uses the DB_* settings (including
 * DB_SSL) from server/.env, or another file:
 *   node --env-file=<file> server/scripts/db-setup.js
 * From the project root:  npm run db:setup            (add -- --seed for test data)
 *
 *   Empty database     -> database/schema.sql: every table, already including
 *                         migrations v2-v6 (so they are not run).
 *                         With --seed: also database/seed.sql (TEST accounts with the
 *                         shared password Password123! and 48 sample reports;
 *                         never for real residents).
 *   Existing database  -> never erased. Already up to date (v6) -> nothing to do.
 *                         Older -> migrations v2, v3, v4, v5, v6 in order (each is safe
 *                         to run twice; they use MariaDB syntax, i.e. XAMPP).
 *   --force            -> ERASES every table and starts again from schema.sql
 *                         (and seed.sql with --seed).
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
const mysql = require('mysql2/promise');
const { sslOptions } = require('../src/config/db');

const args = process.argv.slice(2);
const withSeed = args.includes('--seed');
const force = args.includes('--force');
const DB_NAME = process.env.DB_NAME || 'landayan_ers';
const DATABASE_DIR = path.resolve(__dirname, '../../database');
const MIGRATIONS = ['migration_v2.sql', 'migration_v3.sql', 'migration_v4.sql', 'migration_v5.sql', 'migration_v6.sql'];

// The SQL files name the database "landayan_ers"; use DB_NAME instead (e.g. "railway").
const readSql = (file) => fs.readFileSync(path.join(DATABASE_DIR, file), 'utf8').replace(/landayan_ers/g, DB_NAME);

async function count(connection, sql, params) {
  const [rows] = await connection.query(sql, params);
  return Number(rows[0].n);
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    ssl: sslOptions(), // same SSL settings as the app
    multipleStatements: true,
  });
  // Same time zone as the app (seed dates are relative to "now" in Manila).
  await connection.query('SET time_zone = ?', [process.env.DB_TIME_ZONE || '+08:00']);
  const [[{ version }]] = await connection.query('SELECT VERSION() AS version');
  const isMariaDb = /mariadb/i.test(version);
  console.log(`Database "${DB_NAME}" on ${process.env.DB_HOST || 'localhost'} (${isMariaDb ? 'MariaDB' : 'MySQL'} ${version.split('-')[0]})`);

  const tables = await count(connection, 'SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = ?', [DB_NAME]);

  if (tables === 0 || force) {
    if (tables > 0) console.log(`--force: ERASING all ${tables} tables and their data ...`);
    console.log('Creating every table (schema.sql; it already includes migrations v2-v6) ...');
    await connection.query(readSql('schema.sql'));
    if (withSeed) {
      console.log('Adding TEST data (seed.sql: test accounts, shared password, 48 sample reports) ...');
      await connection.query(readSql('seed.sql'));
    }
  } else {
    if (withSeed) {
      console.error('Refused: --seed only works on an EMPTY database (it would clash with the data already there).');
      console.error('To erase everything and load the test data, run again with --seed --force.');
      await connection.end();
      process.exit(1);
    }
    // Up to date = the newest change (migration v6) is already there.
    const isCurrent = await count(
      connection,
      "SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = ? AND table_name = 'resident' AND column_name = 'token_version'",
      [DB_NAME],
    );
    if (isCurrent) {
      console.log(`The database already has ${tables} tables and is up to date (v6). Nothing to do; no data was changed.`);
    } else if (!isMariaDb) {
      console.error('This database is older than v6, but the migration files use MariaDB (XAMPP) syntax.');
      console.error('Upgrade it on MariaDB, or export the data and import it into a fresh database set up with this script.');
      await connection.end();
      process.exit(1);
    } else {
      console.log('Existing database, older than v6: running migrations v2-v6 (each is safe to run twice) ...');
      for (const file of MIGRATIONS) {
        await connection.query(readSql(file));
        console.log(`  OK ${file}`);
      }
    }
  }

  const result = await count(connection, 'SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = ?', [DB_NAME]);
  const reports = await count(connection, `SELECT COUNT(*) AS n FROM \`${DB_NAME}\`.report`);
  console.log(`Done: ${result} tables, ${reports} reports.`);
  await connection.end();
}

main().catch((error) => {
  console.error('Database setup failed:', error.message);
  process.exit(1);
});
