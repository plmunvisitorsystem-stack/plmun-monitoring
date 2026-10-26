/**
 * Unit tests for the Chat Schedule. Run with:  npm test   (inside /server)
 * Default schedule: Monday-Friday 08:00-17:00 open; Saturday, Sunday closed.
 * 2026-10-26 is a Monday.
 */
const { manilaNow, addDays, hoursFor, getScheduleStatus } = require('./chatSchedule');

const weekly = (dayOfWeek, isOpen = 1) => ({ dayOfWeek, specificDate: null, startTime: '08:00:00', endTime: '17:00:00', isOpen });
const DEFAULT_ROWS = [weekly(1), weekly(2), weekly(3), weekly(4), weekly(5), weekly(6, 0), weekly(7, 0)];
const at = (date, time, dayOfWeek) => ({ date, time, dayOfWeek });

describe('manilaNow (Asia/Manila is UTC+8, no daylight saving)', () => {
  test('converts any moment to the Manila date, time and weekday', () => {
    // 2026-10-26 01:30 UTC = 2026-10-26 09:30 in Manila (Monday)
    expect(manilaNow(new Date('2026-10-26T01:30:00Z'))).toEqual({ date: '2026-10-26', time: '09:30:00', dayOfWeek: 1 });
    // 2026-10-25 20:00 UTC = 2026-10-26 04:00 in Manila: already Monday there
    expect(manilaNow(new Date('2026-10-25T20:00:00Z'))).toEqual({ date: '2026-10-26', time: '04:00:00', dayOfWeek: 1 });
    // Sunday in Manila
    expect(manilaNow(new Date('2026-11-01T02:00:00Z')).dayOfWeek).toBe(7);
  });

  test('addDays moves the date and weekday (across months)', () => {
    expect(addDays('2026-10-30', 3)).toEqual({ date: '2026-11-02', dayOfWeek: 1 });
  });
});

describe('weekday', () => {
  test('Monday 9:30 AM: open', () => {
    const status = getScheduleStatus(DEFAULT_ROWS, at('2026-10-26', '09:30:00', 1));
    expect(status.isOpenNow).toBe(true);
    expect(status.today).toMatchObject({ isOpen: true, start: '08:00', end: '17:00', source: 'weekly' });
    expect(status.nextOpening).toBeNull();
  });

  test('opens exactly at 8:00 AM and closes at 5:00 PM', () => {
    expect(getScheduleStatus(DEFAULT_ROWS, at('2026-10-26', '07:59:59', 1)).isOpenNow).toBe(false);
    expect(getScheduleStatus(DEFAULT_ROWS, at('2026-10-26', '08:00:00', 1)).isOpenNow).toBe(true);
    expect(getScheduleStatus(DEFAULT_ROWS, at('2026-10-26', '16:59:59', 1)).isOpenNow).toBe(true);
    expect(getScheduleStatus(DEFAULT_ROWS, at('2026-10-26', '17:00:00', 1)).isOpenNow).toBe(false);
  });

  test('Monday 6:00 AM: closed, opens today at 8:00', () => {
    const status = getScheduleStatus(DEFAULT_ROWS, at('2026-10-26', '06:00:00', 1));
    expect(status.isOpenNow).toBe(false);
    expect(status.nextOpening).toEqual({ date: '2026-10-26', dayOfWeek: 1, start: '08:00', end: '17:00' });
  });

  test('Friday 6:00 PM: closed, next opening is Monday 8:00', () => {
    const status = getScheduleStatus(DEFAULT_ROWS, at('2026-10-30', '18:00:00', 5));
    expect(status.isOpenNow).toBe(false);
    expect(status.nextOpening).toEqual({ date: '2026-11-02', dayOfWeek: 1, start: '08:00', end: '17:00' });
  });
});

describe('weekend', () => {
  test('Saturday 10:00 AM: closed all day, next opening Monday', () => {
    const status = getScheduleStatus(DEFAULT_ROWS, at('2026-10-31', '10:00:00', 6));
    expect(status.isOpenNow).toBe(false);
    expect(status.today).toMatchObject({ isOpen: false, source: 'weekly' });
    expect(status.nextOpening.date).toBe('2026-11-02');
  });

  test('a weekday with no row at all is closed', () => {
    const status = getScheduleStatus([weekly(1)], at('2026-10-27', '10:00:00', 2));
    expect(status.today).toMatchObject({ isOpen: false, source: 'none' });
    expect(status.nextOpening.date).toBe('2026-11-02');
  });
});

describe('closed and special dates override the weekly hours', () => {
  const holiday = { dayOfWeek: null, specificDate: '2026-11-30', startTime: '08:00:00', endTime: '17:00:00', isOpen: 0 }; // Bonifacio Day, a Monday
  const rows = [...DEFAULT_ROWS, holiday];

  test('a closed date on a Monday: closed all day, next opening Tuesday', () => {
    const status = getScheduleStatus(rows, at('2026-11-30', '10:00:00', 1));
    expect(status.isOpenNow).toBe(false);
    expect(status.today).toMatchObject({ isOpen: false, source: 'special' });
    expect(status.nextOpening).toEqual({ date: '2026-12-01', dayOfWeek: 2, start: '08:00', end: '17:00' });
  });

  test('the next opening skips a closed date', () => {
    const status = getScheduleStatus(rows, at('2026-11-27', '18:00:00', 5)); // Friday evening
    expect(status.nextOpening.date).toBe('2026-12-01');
  });

  test('special hours on a Saturday open the chat for those hours only', () => {
    const special = { dayOfWeek: null, specificDate: '2026-10-31', startTime: '09:00:00', endTime: '12:00:00', isOpen: 1 };
    expect(getScheduleStatus([...DEFAULT_ROWS, special], at('2026-10-31', '10:00:00', 6)).isOpenNow).toBe(true);
    expect(getScheduleStatus([...DEFAULT_ROWS, special], at('2026-10-31', '12:30:00', 6)).isOpenNow).toBe(false);
  });

  test('hoursFor treats start >= end as closed', () => {
    const bad = { dayOfWeek: 1, specificDate: null, startTime: '17:00:00', endTime: '08:00:00', isOpen: 1 };
    expect(hoursFor([bad], '2026-10-26', 1).isOpen).toBe(false);
  });
});
