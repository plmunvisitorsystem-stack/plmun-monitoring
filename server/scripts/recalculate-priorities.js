/**
 * Recalculates the priority of EVERY report with the current rules
 * (services/smartRules.js + config/rules.js), replaying the reports in the
 * order they were submitted. New reports already get their priority
 * automatically; run this only after changing the rules:
 *
 *   npm run recalc-priorities            (shows what would change)
 *   npm run recalc-priorities -- --save  (saves the changes)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const { pool } = require('../src/config/db');
const { calculatePriorities } = require('../services/smartRules');

async function main() {
  const save = process.argv.includes('--save');
  const [reports] = await pool.query(
    `SELECT report_id AS id, issue_type AS issueType, area, status,
            date_submitted AS dateSubmitted, priority
     FROM report`,
  );

  const newPriorities = calculatePriorities(reports);
  const changes = reports.filter((report) => newPriorities.get(report.id) !== report.priority);

  for (const report of changes) {
    console.log(`Report ${report.id} (${report.issueType}, ${report.area}): ${report.priority} -> ${newPriorities.get(report.id)}`);
    if (save) await pool.execute('UPDATE report SET priority = ? WHERE report_id = ?', [newPriorities.get(report.id), report.id]);
  }

  console.log(`${reports.length} reports checked, ${changes.length} ${save ? 'updated' : 'would change (add -- --save to save)'}.`);
  await pool.end();
}

main().catch(async (error) => {
  console.error('Could not recalculate priorities:', error.message);
  await pool.end();
  process.exit(1);
});
