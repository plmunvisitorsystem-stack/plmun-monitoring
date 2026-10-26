/**
 * Unit tests for the Chat Schedule validators (LGU Chat Schedule page). Run with:  npm test
 */
const { validateWeeklySchedule, validateSpecialDate } = require('./validators');

const day = (dayOfWeek, isOpen = true, start = '08:00', end = '17:00') => ({ dayOfWeek, isOpen, start, end });
const WEEK = [day(1), day(2), day(3), day(4), day(5), day(6, false), day(7, false)];

describe('validateWeeklySchedule', () => {
  test('accepts the 7 days in any order and sorts them Monday first', () => {
    const { days, errors } = validateWeeklySchedule({ days: [...WEEK].reverse() });
    expect(errors).toEqual({});
    expect(days.map((d) => d.dayOfWeek)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(days[5]).toEqual({ dayOfWeek: 6, isOpen: false, start: '08:00', end: '17:00' });
  });

  test('needs exactly the 7 weekdays, once each', () => {
    expect(validateWeeklySchedule({ days: WEEK.slice(0, 6) }).errors).toEqual({ days: 'INVALID_SCHEDULE' });
    expect(validateWeeklySchedule({ days: [...WEEK.slice(0, 6), day(1)] }).errors).toEqual({ days: 'INVALID_SCHEDULE' });
    expect(validateWeeklySchedule({ days: [...WEEK.slice(0, 6), day(8)] }).errors).toEqual({ days: 'INVALID_SCHEDULE' });
    expect(validateWeeklySchedule({}).errors).toEqual({ days: 'INVALID_SCHEDULE' });
  });

  test('an open day needs valid times with start before end', () => {
    const week = [...WEEK];
    week[2] = day(3, true, '17:00', '08:00');
    week[3] = day(4, true, '8am', '17:00');
    expect(validateWeeklySchedule({ days: week }).errors).toEqual({ day3: 'INVALID_TIME_RANGE', day4: 'INVALID_TIME' });
  });

  test('a closed day may have empty times (defaults are kept)', () => {
    const week = [...WEEK];
    week[6] = { dayOfWeek: 7, isOpen: false, start: '', end: '' };
    const { days, errors } = validateWeeklySchedule({ days: week });
    expect(errors).toEqual({});
    expect(days[6]).toEqual({ dayOfWeek: 7, isOpen: false, start: '08:00', end: '17:00' });
  });
});

describe('validateSpecialDate (today = 2026-10-26 in Manila)', () => {
  const TODAY = '2026-10-26';

  test('a closed holiday needs only the date', () => {
    expect(validateSpecialDate({ date: '2026-12-25', isOpen: false }, TODAY)).toEqual({
      values: { date: '2026-12-25', isOpen: false, start: '08:00', end: '17:00' },
      errors: {},
    });
  });

  test('today is allowed; past and invalid dates are not', () => {
    expect(validateSpecialDate({ date: TODAY, isOpen: false }, TODAY).errors).toEqual({});
    expect(validateSpecialDate({ date: '2026-10-25', isOpen: false }, TODAY).errors).toEqual({ date: 'DATE_IN_PAST' });
    expect(validateSpecialDate({ date: '2026-02-30', isOpen: false }, TODAY).errors).toEqual({ date: 'INVALID_DATE' });
    expect(validateSpecialDate({ isOpen: false }, TODAY).errors).toEqual({ date: 'FIELD_REQUIRED' });
  });

  test('different hours need a valid time range', () => {
    expect(validateSpecialDate({ date: '2026-12-24', isOpen: true, start: '08:00', end: '12:00' }, TODAY).errors).toEqual({});
    expect(validateSpecialDate({ date: '2026-12-24', isOpen: true, start: '12:00', end: '12:00' }, TODAY).errors).toEqual({
      end: 'INVALID_TIME_RANGE',
    });
  });
});
