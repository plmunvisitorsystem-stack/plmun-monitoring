/**
 * Builds a CSV file that opens correctly in Microsoft Excel:
 * - starts with a UTF-8 BOM so Excel shows letters like ñ correctly
 * - every value in double quotes; quotes inside are doubled ("")
 *   so commas and line breaks inside a description stay in one cell
 * - Windows line endings (\r\n)
 * - values starting with = + - @ get a leading ' so Excel does not run
 *   them as formulas (protection against "CSV injection")
 */
const BOM = '﻿';

function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * headers: ['Report ID', ...], rows: [['#2026-0001', ...], ...]
 * extraTables (optional): more tables placed under the first one, each after
 *   an empty line and a title line: [{ title, headers, rows }]
 */
function toCsv(headers, rows, extraTables = []) {
  const lines = [headers, ...rows].map((cells) => cells.map(csvCell).join(','));
  for (const table of extraTables) {
    lines.push('', csvCell(table.title));
    lines.push(...[table.headers, ...table.rows].map((cells) => cells.map(csvCell).join(',')));
  }
  return BOM + lines.join('\r\n') + '\r\n';
}

module.exports = { toCsv };
