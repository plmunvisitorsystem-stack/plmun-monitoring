/**
 * Report IDs are shown as #YYYY-#### (year submitted + 4-digit id).
 *   formatReportId(101, '2026-10-09 05:45:00') -> '#2026-0101'
 * (Same rule as client/src/utils/format.js.)
 */
function formatReportId(id, dateSubmitted) {
  const year = String(dateSubmitted).slice(0, 4);
  return `#${year}-${String(id).padStart(4, '0')}`;
}

module.exports = { formatReportId };
