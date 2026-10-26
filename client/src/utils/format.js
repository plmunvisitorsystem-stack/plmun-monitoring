/**
 * Formatting helpers for report IDs and dates.
 */

/**
 * Report IDs are shown as #YYYY-#### (year submitted + 4-digit id).
 *   formatReportId(102, '2026-10-09 05:45:00') -> '#2026-0102'
 */
export function formatReportId(id, dateSubmitted) {
  const year = String(dateSubmitted).slice(0, 4);
  return `#${year}-${String(id).padStart(4, '0')}`;
}

// The API sends dates as "YYYY-MM-DD HH:MM:SS" (local barangay time).
// We build the Date from the parts so the browser does not shift the time zone.
function parseDbDate(value) {
  const [datePart, timePart = '00:00:00'] = String(value).split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute);
}

// Filipino locale gives Tagalog month names (e.g. "Oktubre 9, 2026").
const LOCALES = { en: 'en-PH', tl: 'fil-PH' };

/** "October 9, 2026" / "Oktubre 9, 2026" */
export function formatDate(value, language) {
  return new Intl.DateTimeFormat(LOCALES[language] || 'en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(parseDbDate(value));
}

/** 0.375 -> "37.5%" */
export function formatPercent(value, language) {
  return new Intl.NumberFormat(LOCALES[language] || 'en-PH', { style: 'percent', maximumFractionDigits: 1 }).format(value);
}

/** "October 9, 2026 at 5:45 AM" / "Oktubre 9, 2026 nang 5:45 AM" */
export function formatDateTime(value, language) {
  return new Intl.DateTimeFormat(LOCALES[language] || 'en-PH', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(parseDbDate(value));
}

/** A clock time from the Chat Schedule: '08:00' -> "8:00 AM" (EN) / "8:00 AM" (TL). */
export function formatClock(time, language) {
  const [hour, minute] = String(time).split(':').map(Number);
  return new Intl.DateTimeFormat(LOCALES[language] || 'en-PH', { hour: 'numeric', minute: '2-digit' }).format(new Date(2000, 0, 1, hour, minute));
}

/** A schedule date with its weekday: '2026-10-27' -> "Tuesday, October 27" / "Martes, Oktubre 27". */
export function formatWeekdayDate(date, language) {
  const [year, month, day] = String(date).split('-').map(Number);
  return new Intl.DateTimeFormat(LOCALES[language] || 'en-PH', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(year, month - 1, day));
}

/** Time of day of a database date: "2026-10-26 09:05:00" -> "9:05 AM" (chat message times). */
export function formatTimeOfDay(value, language) {
  return new Intl.DateTimeFormat(LOCALES[language] || 'en-PH', { hour: 'numeric', minute: '2-digit' }).format(parseDbDate(value));
}
