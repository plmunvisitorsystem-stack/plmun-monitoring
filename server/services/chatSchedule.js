/**
 * Chat Schedule: is live chat open right now?
 *
 * Live chat is open only during the Chat Schedule set by the LGU
 * administrator (table chat_schedule), always in Asia/Manila time:
 *   - weekly rows:  day_of_week 1 = Monday ... 7 = Sunday
 *   - special rows: specific_date (e.g. a holiday); they OVERRIDE the weekly
 *     row for that date (is_open 0 = closed all day, 1 = these hours)
 *   - a day with no row at all is closed
 * Open means: start_time <= now < end_time (e.g. 08:00 to 17:00 -> open at
 * 8:00 AM, closed from 5:00 PM).
 *
 * The functions are "pure" (they get the rows and the time), so they are easy
 * to unit test (chatSchedule.test.js). getChatStatus() reads the database.
 */
const TIME_ZONE = 'Asia/Manila';
const DAYS_TO_SEARCH = 60; // how far ahead to look for the next opening

/**
 * The date and time in Manila for a moment (default: now), whatever time
 * zone the computer or the database uses.
 * Returns { date: 'YYYY-MM-DD', time: 'HH:MM:SS', dayOfWeek: 1-7 (Monday = 1) }.
 */
function manilaNow(moment = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
      hourCycle: 'h23',
    })
      .formatToParts(moment)
      .map((part) => [part.type, part.value]),
  );
  const dayOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(parts.weekday) + 1;
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}:${parts.second}`, dayOfWeek };
}

/** 'YYYY-MM-DD' plus a number of days -> { date, dayOfWeek }. */
function addDays(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  const isoDay = d.getUTCDay() === 0 ? 7 : d.getUTCDay(); // Sunday 0 -> 7
  return { date: d.toISOString().slice(0, 10), dayOfWeek: isoDay };
}

const hhmm = (time) => String(time).slice(0, 5); // '08:00:00' -> '08:00'

/**
 * The hours for one date.
 *   rows: chat_schedule rows { dayOfWeek, specificDate, startTime, endTime, isOpen }
 * Returns { date, dayOfWeek, isOpen, start, end, source }
 *   source: 'special' (a specific_date row), 'weekly', or 'none' (no row = closed)
 */
function hoursFor(rows, date, dayOfWeek) {
  const special = rows.find((row) => row.specificDate === date);
  const weekly = rows.find((row) => row.specificDate === null && Number(row.dayOfWeek) === dayOfWeek);
  const row = special || weekly;
  if (!row) return { date, dayOfWeek, isOpen: false, start: null, end: null, source: 'none' };
  return {
    date,
    dayOfWeek,
    isOpen: Boolean(Number(row.isOpen)) && hhmm(row.startTime) < hhmm(row.endTime),
    start: hhmm(row.startTime),
    end: hhmm(row.endTime),
    source: special ? 'special' : 'weekly',
  };
}

/**
 * Open or closed right now, today's hours, and the next opening time.
 *   now: { date, time, dayOfWeek } from manilaNow()
 */
function getScheduleStatus(rows, now) {
  const today = hoursFor(rows, now.date, now.dayOfWeek);
  const time = hhmm(now.time);
  const isOpenNow = today.isOpen && time >= today.start && time < today.end;

  // Next opening: later today (before opening time), or the next open day.
  let nextOpening = null;
  if (!isOpenNow) {
    if (today.isOpen && time < today.start) {
      nextOpening = { date: today.date, dayOfWeek: today.dayOfWeek, start: today.start, end: today.end };
    } else {
      for (let i = 1; i <= DAYS_TO_SEARCH && !nextOpening; i++) {
        const day = addDays(now.date, i);
        const hours = hoursFor(rows, day.date, day.dayOfWeek);
        if (hours.isOpen) nextOpening = { date: hours.date, dayOfWeek: hours.dayOfWeek, start: hours.start, end: hours.end };
      }
    }
  }

  return { isOpenNow, today, nextOpening };
}

/**
 * GET /api/chat/status data, read from the database.
 *   db: the pool
 */
async function getChatStatus(db, moment = new Date()) {
  const [rows] = await db.execute(
    `SELECT day_of_week AS dayOfWeek, specific_date AS specificDate,
            start_time AS startTime, end_time AS endTime, is_open AS isOpen
     FROM chat_schedule`,
  );
  // Staff who set themselves "Available" (any LGU or response team account).
  const [[{ availableStaff }]] = await db.query(
    `SELECT (SELECT COUNT(*) FROM response_team WHERE chat_availability = 'Available')
          + (SELECT COUNT(*) FROM lgu WHERE chat_availability = 'Available') AS availableStaff`,
  );

  const now = manilaNow(moment);
  const status = getScheduleStatus(rows, now);
  return {
    timeZone: TIME_ZONE,
    now,
    ...status,
    availableStaff: Number(availableStaff),
  };
}

module.exports = { TIME_ZONE, manilaNow, addDays, hoursFor, getScheduleStatus, getChatStatus };
