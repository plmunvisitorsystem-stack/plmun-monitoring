/**
 * Smart features (rule-based, no AI). All numbers come from config/rules.js.
 *
 * 1. Automatic priority level
 *    - Every issue type has a BASE priority:
 *        Flooding -> High;  Pollution, Other Hazard -> Medium;  Waste Disposal -> Low
 *    - When a report is submitted, count the reports with the same issue type
 *      in the same area submitted in the last PRIORITY_RAISE_DAYS days
 *      (including the new one). If the count is PRIORITY_RAISE_COUNT or more,
 *      the priority is raised ONE level (Low -> Medium -> High, never above High)
 *      for the new report AND for the other unresolved matching reports.
 *      Example: 3 Waste Disposal reports in Purok 2 within 7 days -> all Medium.
 *      A 4th one keeps them at Medium (one level above the base, not two).
 *
 * 2. Similar report detection
 *    - A report is "similar" to an UNRESOLVED report with the same issue type
 *      in the same area submitted in the last SIMILAR_DAYS days (the newest one).
 *
 * 3. Overdue reports
 *    - Not Resolved and submitted more than OVERDUE_DAYS days ago.
 *
 * 4. Hotspots
 *    - Areas with HOTSPOT_COUNT or more reports in the last HOTSPOT_DAYS days.
 *
 * The first functions below are "pure" (no database), so they are easy to
 * unit test (see smartRules.test.js). The async ones use the database.
 */
const RULES = require('../config/rules');

// Lowest to highest.
const PRIORITY_LEVELS = ['Low', 'Medium', 'High'];

const BASE_PRIORITY = {
  Flooding: 'High',
  Pollution: 'Medium',
  'Other Hazard': 'Medium',
  'Waste Disposal': 'Low',
};

/** Starting priority of an issue type, e.g. getBasePriority('Flooding') -> 'High'. */
function getBasePriority(issueType) {
  const priority = BASE_PRIORITY[issueType];
  if (!priority) throw new Error(`Unknown issue type: ${issueType}`);
  return priority;
}

/** One level up: Low -> Medium -> High; High stays High. */
function raisePriority(priority) {
  const index = PRIORITY_LEVELS.indexOf(priority);
  if (index === -1) throw new Error(`Unknown priority: ${priority}`);
  return PRIORITY_LEVELS[Math.min(index + 1, PRIORITY_LEVELS.length - 1)];
}

/** True when priority a is lower than priority b (e.g. 'Low' < 'Medium'). */
function isLowerPriority(a, b) {
  return PRIORITY_LEVELS.indexOf(a) < PRIORITY_LEVELS.indexOf(b);
}

/** True when this many matching reports (including the new one) raise the priority. */
function shouldRaise(recentCount) {
  return recentCount >= RULES.PRIORITY_RAISE_COUNT;
}

/**
 * Priority of a new report:
 *   recentCount = matching reports in the last PRIORITY_RAISE_DAYS days, including the new one.
 */
function getPriority(issueType, recentCount) {
  const base = getBasePriority(issueType);
  return shouldRaise(recentCount) ? raisePriority(base) : base;
}

// "2026-10-25 08:30:00" -> milliseconds (dates from the database are local time strings).
const DAY_MS = 24 * 60 * 60 * 1000;
function toTime(dateText) {
  return new Date(`${String(dateText).replace(' ', 'T')}Z`).getTime();
}

/**
 * Replays the priority rule over existing reports, oldest first, as if each
 * had just been submitted at its date. Used by scripts/recalculate-priorities.js
 * (for example after changing a number in config/rules.js) and by the seed data.
 *   reports: [{ id, issueType, area, status, dateSubmitted }]
 * Returns a Map: report id -> priority.
 */
function calculatePriorities(reports) {
  const sorted = [...reports].sort((a, b) => toTime(a.dateSubmitted) - toTime(b.dateSubmitted) || a.id - b.id);
  const priorities = new Map();

  sorted.forEach((report, index) => {
    const windowStart = toTime(report.dateSubmitted) - RULES.PRIORITY_RAISE_DAYS * DAY_MS;
    // Earlier reports (in sorted order) with the same issue type and area inside the window.
    const matching = sorted
      .slice(0, index)
      .filter((other) => other.issueType === report.issueType && other.area === report.area && toTime(other.dateSubmitted) >= windowStart);

    const priority = getPriority(report.issueType, matching.length + 1);
    priorities.set(report.id, priority);

    if (shouldRaise(matching.length + 1)) {
      for (const other of matching) {
        if (other.status !== 'Resolved' && isLowerPriority(priorities.get(other.id), priority)) {
          priorities.set(other.id, priority);
        }
      }
    }
  });
  return priorities;
}

// ---------------------------------------------------------------------------
// 3. Overdue reports
//    A report is overdue when it is NOT Resolved and was submitted more than
//    OVERDUE_DAYS days ago. It is calculated in every query (never saved),
//    so it is always current: it stops being overdue the moment it is Resolved.
// ---------------------------------------------------------------------------
if (!Number.isInteger(RULES.OVERDUE_DAYS) || RULES.OVERDUE_DAYS < 1) {
  throw new Error('OVERDUE_DAYS in config/rules.js must be a whole number of days (1 or more).');
}

/**
 * SQL condition that is 1 (true) for an overdue report, e.g.
 *   SELECT ..., ${overdueSql('r')} AS isOverdue FROM report r
 *   WHERE ... AND ${overdueSql('r')}
 * alias: the table alias used in the query ('' when there is none).
 * OVERDUE_DAYS is checked above to be a whole number, so putting it into the SQL is safe.
 */
function overdueSql(alias = '') {
  const column = (name) => (alias ? `${alias}.${name}` : name);
  return `(${column('status')} <> 'Resolved' AND ${column('date_submitted')} < NOW() - INTERVAL ${RULES.OVERDUE_DAYS} DAY)`;
}

/** The same rule in JavaScript (used by the unit tests). now: "YYYY-MM-DD HH:MM:SS". */
function isOverdue(report, now) {
  return report.status !== 'Resolved' && toTime(report.dateSubmitted) < toTime(now) - RULES.OVERDUE_DAYS * DAY_MS;
}

/** MySQL answers 0 / 1 for the isOverdue column; the API sends true / false. */
function withOverdueFlag(row) {
  return { ...row, isOverdue: Boolean(Number(row.isOverdue)) };
}

// ---------------------------------------------------------------------------
// 4. Hotspots
//    An area is a hotspot when it has HOTSPOT_COUNT or more reports (any
//    status) submitted in the last HOTSPOT_DAYS days.
// ---------------------------------------------------------------------------
const ISSUE_TYPES = ['Waste Disposal', 'Pollution', 'Flooding', 'Other Hazard'];

/**
 * Turns counts per area and issue type into the hotspot list.
 *   rows: [{ area, issueType, total }] (already limited to the last HOTSPOT_DAYS days)
 * Returns [{ area, total, byIssueType: { 'Waste Disposal': 2, ... }, topIssueType }],
 * only areas with total >= HOTSPOT_COUNT, highest total first (then area name).
 * topIssueType = the most common issue type; a tie goes to the type listed first in ISSUE_TYPES.
 */
function buildHotspots(rows) {
  const areas = new Map();
  for (const row of rows) {
    if (!areas.has(row.area)) {
      areas.set(row.area, { area: row.area, total: 0, byIssueType: Object.fromEntries(ISSUE_TYPES.map((type) => [type, 0])) });
    }
    const entry = areas.get(row.area);
    entry.byIssueType[row.issueType] = (entry.byIssueType[row.issueType] || 0) + Number(row.total);
    entry.total += Number(row.total);
  }

  return [...areas.values()]
    .filter((entry) => entry.total >= RULES.HOTSPOT_COUNT)
    .map((entry) => ({
      ...entry,
      topIssueType: ISSUE_TYPES.reduce((best, type) => (entry.byIssueType[type] > entry.byIssueType[best] ? type : best)),
    }))
    .sort((a, b) => b.total - a.total || a.area.localeCompare(b.area, 'en', { numeric: true }));
}

// ---------------------------------------------------------------------------
// Database functions. db = the pool or a connection inside a transaction.
// ---------------------------------------------------------------------------

/**
 * Hotspots now (see buildHotspots).
 *   areas: null = every area (LGU); a list = only these areas (a team's assigned area).
 */
async function findHotspots(db, areas = null) {
  if (Array.isArray(areas) && areas.length === 0) return [];
  const areaSql = areas ? `AND area IN (${areas.map(() => '?').join(', ')})` : '';
  const [rows] = await db.execute(
    `SELECT area, issue_type AS issueType, COUNT(*) AS total
     FROM report
     WHERE date_submitted >= NOW() - INTERVAL ? DAY ${areaSql}
     GROUP BY area, issue_type`,
    [RULES.HOTSPOT_DAYS, ...(areas || [])],
  );
  return buildHotspots(rows);
}

/**
 * The newest UNRESOLVED report with the same issue type and area submitted in
 * the last SIMILAR_DAYS days, as { id, dateSubmitted }, or null.
 */
async function findSimilarReport(db, { issueType, area }) {
  const [rows] = await db.execute(
    `SELECT report_id AS id, date_submitted AS dateSubmitted
     FROM report
     WHERE issue_type = ? AND area = ? AND status <> 'Resolved'
       AND date_submitted >= NOW() - INTERVAL ? DAY
     ORDER BY date_submitted DESC, report_id DESC
     LIMIT 1`,
    [issueType, area, RULES.SIMILAR_DAYS],
  );
  return rows[0] || null;
}

/**
 * Runs the priority rule for a report that was JUST saved (so it is part of the count).
 * Sets its priority and, when the count is high enough, raises the other
 * unresolved matching reports to the same level.
 * Returns { priority, recentCount, raisedReportIds }.
 */
async function applyPriorityRules(db, { reportId, issueType, area }) {
  const [[{ recentCount }]] = await db.execute(
    `SELECT COUNT(*) AS recentCount FROM report
     WHERE issue_type = ? AND area = ? AND date_submitted >= NOW() - INTERVAL ? DAY`,
    [issueType, area, RULES.PRIORITY_RAISE_DAYS],
  );
  const count = Number(recentCount);
  const priority = getPriority(issueType, count);
  await db.execute('UPDATE report SET priority = ? WHERE report_id = ?', [priority, reportId]);

  let raisedReportIds = [];
  if (shouldRaise(count)) {
    const [others] = await db.execute(
      `SELECT report_id AS id, priority FROM report
       WHERE issue_type = ? AND area = ? AND date_submitted >= NOW() - INTERVAL ? DAY
         AND status <> 'Resolved' AND report_id <> ?`,
      [issueType, area, RULES.PRIORITY_RAISE_DAYS, reportId],
    );
    raisedReportIds = others.filter((other) => isLowerPriority(other.priority, priority)).map((other) => other.id);
    if (raisedReportIds.length > 0) {
      const placeholders = raisedReportIds.map(() => '?').join(', ');
      await db.execute(`UPDATE report SET priority = ? WHERE report_id IN (${placeholders})`, [priority, ...raisedReportIds]);
    }
  }
  return { priority, recentCount: count, raisedReportIds };
}

module.exports = {
  OVERDUE_DAYS: RULES.OVERDUE_DAYS,
  PRIORITY_LEVELS,
  getBasePriority,
  raisePriority,
  isLowerPriority,
  shouldRaise,
  getPriority,
  calculatePriorities,
  overdueSql,
  isOverdue,
  withOverdueFlag,
  buildHotspots,
  findHotspots,
  findSimilarReport,
  applyPriorityRules,
};
