/**
 * Unit tests for the smart rules. Run with:  npm test   (inside /server)
 * The database functions get a small fake "db" object, so no MySQL is needed.
 * The numbers used here (3 reports, 7 days, 3 days) come from config/rules.js.
 */
const RULES = require('../config/rules');
const {
  getBasePriority,
  raisePriority,
  isLowerPriority,
  getPriority,
  calculatePriorities,
  overdueSql,
  isOverdue,
  withOverdueFlag,
  buildHotspots,
  findHotspots,
  findSimilarReport,
  applyPriorityRules,
} = require('./smartRules');

// A fake database: answers each execute() call with the next prepared result
// and remembers every query, so the tests can check what was sent.
function fakeDb(results) {
  const calls = [];
  return {
    calls,
    execute: jest.fn(async (sql, params) => {
      calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
      return results.shift() || [[]];
    }),
  };
}

test('the rule numbers are the ones from the project rules', () => {
  expect(RULES.PRIORITY_RAISE_COUNT).toBe(3);
  expect(RULES.PRIORITY_RAISE_DAYS).toBe(7);
  expect(RULES.SIMILAR_DAYS).toBe(3);
});

describe('getBasePriority', () => {
  test('Flooding is High', () => expect(getBasePriority('Flooding')).toBe('High'));
  test('Pollution is Medium', () => expect(getBasePriority('Pollution')).toBe('Medium'));
  test('Other Hazard is Medium', () => expect(getBasePriority('Other Hazard')).toBe('Medium'));
  test('Waste Disposal is Low', () => expect(getBasePriority('Waste Disposal')).toBe('Low'));
  test('an unknown issue type is an error', () => expect(() => getBasePriority('Noise')).toThrow());
});

describe('raisePriority', () => {
  test('Low -> Medium', () => expect(raisePriority('Low')).toBe('Medium'));
  test('Medium -> High', () => expect(raisePriority('Medium')).toBe('High'));
  test('High stays High (maximum)', () => expect(raisePriority('High')).toBe('High'));
  test('isLowerPriority compares levels', () => {
    expect(isLowerPriority('Low', 'Medium')).toBe(true);
    expect(isLowerPriority('High', 'Medium')).toBe(false);
    expect(isLowerPriority('Medium', 'Medium')).toBe(false);
  });
});

describe('getPriority (new report)', () => {
  test('below the raise count: the base priority', () => {
    expect(getPriority('Waste Disposal', 1)).toBe('Low');
    expect(getPriority('Waste Disposal', 2)).toBe('Low');
    expect(getPriority('Pollution', 2)).toBe('Medium');
  });
  test('3 or more matching reports: one level up', () => {
    expect(getPriority('Waste Disposal', 3)).toBe('Medium');
    expect(getPriority('Waste Disposal', 10)).toBe('Medium'); // one level only, not two
    expect(getPriority('Pollution', 3)).toBe('High');
    expect(getPriority('Other Hazard', 4)).toBe('High');
  });
  test('Flooding is always High', () => {
    for (const count of [1, 2, 3, 20]) expect(getPriority('Flooding', count)).toBe('High');
  });
});

describe('calculatePriorities (replaying reports in date order)', () => {
  const report = (id, issueType, area, dateSubmitted, status = 'Submitted') => ({ id, issueType, area, dateSubmitted, status });

  test('3 Waste Disposal reports in the same area within 7 days all become Medium', () => {
    const result = calculatePriorities([
      report(1, 'Waste Disposal', 'Purok 2', '2026-10-01 08:00:00'),
      report(2, 'Waste Disposal', 'Purok 2', '2026-10-03 08:00:00'),
      report(3, 'Waste Disposal', 'Purok 2', '2026-10-07 20:00:00'),
    ]);
    expect([...result.values()]).toEqual(['Medium', 'Medium', 'Medium']);
  });

  test('only 2 matching reports: they stay at the base priority', () => {
    const result = calculatePriorities([
      report(1, 'Waste Disposal', 'Purok 2', '2026-10-01 08:00:00'),
      report(2, 'Waste Disposal', 'Purok 2', '2026-10-02 08:00:00'),
    ]);
    expect([...result.values()]).toEqual(['Low', 'Low']);
  });

  test('reports more than 7 days apart are not counted together', () => {
    const result = calculatePriorities([
      report(1, 'Waste Disposal', 'Purok 2', '2026-10-01 08:00:00'),
      report(2, 'Waste Disposal', 'Purok 2', '2026-10-05 08:00:00'),
      report(3, 'Waste Disposal', 'Purok 2', '2026-10-09 08:00:00'), // report 1 is 8 days earlier
    ]);
    expect(result.get(3)).toBe('Low');
    expect(result.get(1)).toBe('Low');
  });

  test('a different area or issue type does not count', () => {
    const result = calculatePriorities([
      report(1, 'Waste Disposal', 'Purok 2', '2026-10-01 08:00:00'),
      report(2, 'Waste Disposal', 'Purok 3', '2026-10-02 08:00:00'),
      report(3, 'Pollution', 'Purok 2', '2026-10-03 08:00:00'),
      report(4, 'Waste Disposal', 'Purok 2', '2026-10-04 08:00:00'),
    ]);
    expect(result.get(4)).toBe('Low');
    expect(result.get(3)).toBe('Medium'); // base priority of Pollution
  });

  test('a Resolved report is not raised, but still counts', () => {
    const result = calculatePriorities([
      report(1, 'Waste Disposal', 'Purok 2', '2026-10-01 08:00:00', 'Resolved'),
      report(2, 'Waste Disposal', 'Purok 2', '2026-10-02 08:00:00', 'In Progress'),
      report(3, 'Waste Disposal', 'Purok 2', '2026-10-03 08:00:00'),
    ]);
    expect(result.get(1)).toBe('Low');
    expect(result.get(2)).toBe('Medium');
    expect(result.get(3)).toBe('Medium');
  });

  test('Flooding stays High however many reports there are', () => {
    const result = calculatePriorities([1, 2, 3, 4].map((id) => report(id, 'Flooding', 'Purok 4', `2026-10-0${id} 08:00:00`)));
    expect([...result.values()]).toEqual(['High', 'High', 'High', 'High']);
  });
});

describe('overdue reports', () => {
  const now = '2026-10-25 12:00:00';
  test('OVERDUE_DAYS is 7', () => expect(RULES.OVERDUE_DAYS).toBe(7));
  test('In Progress and submitted 8 days ago: overdue', () => {
    expect(isOverdue({ status: 'In Progress', dateSubmitted: '2026-10-17 12:00:00' }, now)).toBe(true);
  });
  test('the same report after it is Resolved: not overdue', () => {
    expect(isOverdue({ status: 'Resolved', dateSubmitted: '2026-10-17 12:00:00' }, now)).toBe(false);
  });
  test('submitted 6 days ago: not overdue yet', () => {
    expect(isOverdue({ status: 'Submitted', dateSubmitted: '2026-10-19 12:00:00' }, now)).toBe(false);
  });
  test('exactly 7 days is not "more than" 7 days', () => {
    expect(isOverdue({ status: 'Under Review', dateSubmitted: '2026-10-18 12:00:00' }, now)).toBe(false);
    expect(isOverdue({ status: 'Under Review', dateSubmitted: '2026-10-18 11:59:59' }, now)).toBe(true);
  });
  test('the SQL condition uses the same rule, with or without a table alias', () => {
    expect(overdueSql('r')).toBe("(r.status <> 'Resolved' AND r.date_submitted < NOW() - INTERVAL 7 DAY)");
    expect(overdueSql()).toBe("(status <> 'Resolved' AND date_submitted < NOW() - INTERVAL 7 DAY)");
  });
  test('withOverdueFlag turns MySQL 0/1 into false/true', () => {
    expect(withOverdueFlag({ id: 1, isOverdue: 1 }).isOverdue).toBe(true);
    expect(withOverdueFlag({ id: 2, isOverdue: 0 }).isOverdue).toBe(false);
    expect(withOverdueFlag({ id: 3, isOverdue: '1' }).isOverdue).toBe(true);
  });
});

describe('hotspots', () => {
  test('HOTSPOT_COUNT is 5 and HOTSPOT_DAYS is 30', () => {
    expect(RULES.HOTSPOT_COUNT).toBe(5);
    expect(RULES.HOTSPOT_DAYS).toBe(30);
  });

  test('an area with 4 reports is not a hotspot; 5 reports is', () => {
    expect(buildHotspots([{ area: 'Purok 2', issueType: 'Flooding', total: 4 }])).toEqual([]);
    const [spot] = buildHotspots([
      { area: 'Purok 2', issueType: 'Flooding', total: 3 },
      { area: 'Purok 2', issueType: 'Waste Disposal', total: 2 },
    ]);
    expect(spot).toEqual({
      area: 'Purok 2',
      total: 5,
      byIssueType: { 'Waste Disposal': 2, Pollution: 0, Flooding: 3, 'Other Hazard': 0 },
      topIssueType: 'Flooding',
    });
  });

  test('ranked by total, highest first; same total -> area name', () => {
    const list = buildHotspots([
      { area: 'Purok 7', issueType: 'Pollution', total: 6 },
      { area: 'Purok 4', issueType: 'Flooding', total: 9 },
      { area: 'Purok 1', issueType: 'Pollution', total: 6 },
    ]);
    expect(list.map((spot) => spot.area)).toEqual(['Purok 4', 'Purok 1', 'Purok 7']);
  });

  test('a tie for the most common issue type goes to the first in the list', () => {
    const [spot] = buildHotspots([
      { area: 'Purok 3', issueType: 'Other Hazard', total: 3 },
      { area: 'Purok 3', issueType: 'Pollution', total: 3 },
    ]);
    expect(spot.topIssueType).toBe('Pollution');
  });

  test('findHotspots asks for the last HOTSPOT_DAYS days, all areas or only the given ones', async () => {
    const all = fakeDb([[[{ area: 'Purok 4', issueType: 'Flooding', total: 5 }]]]);
    expect(await findHotspots(all)).toHaveLength(1);
    expect(all.calls[0].params).toEqual([RULES.HOTSPOT_DAYS]);
    expect(all.calls[0].sql).not.toContain('area IN');

    const team = fakeDb([[[]]]);
    await findHotspots(team, ['Purok 1', 'Purok 2']);
    expect(team.calls[0].sql).toContain('area IN (?, ?)');
    expect(team.calls[0].params).toEqual([RULES.HOTSPOT_DAYS, 'Purok 1', 'Purok 2']);

    const none = fakeDb([]);
    expect(await findHotspots(none, [])).toEqual([]);
    expect(none.calls).toHaveLength(0);
  });
});

describe('findSimilarReport (database)', () => {
  test('asks for an unresolved report, same issue type and area, within SIMILAR_DAYS days', async () => {
    const db = fakeDb([[[{ id: 7, dateSubmitted: '2026-10-24 09:00:00' }]]]);
    const similar = await findSimilarReport(db, { issueType: 'Flooding', area: 'Purok 4' });
    expect(similar).toEqual({ id: 7, dateSubmitted: '2026-10-24 09:00:00' });
    expect(db.calls[0].sql).toContain("status <> 'Resolved'");
    expect(db.calls[0].sql).toContain('ORDER BY date_submitted DESC');
    expect(db.calls[0].params).toEqual(['Flooding', 'Purok 4', RULES.SIMILAR_DAYS]);
  });

  test('returns null when there is no match', async () => {
    const db = fakeDb([[[]]]);
    expect(await findSimilarReport(db, { issueType: 'Pollution', area: 'Purok 1' })).toBeNull();
  });
});

describe('applyPriorityRules (database)', () => {
  test('below the raise count: sets the base priority and changes nothing else', async () => {
    const db = fakeDb([[[{ recentCount: 2 }]], [{}]]);
    const result = await applyPriorityRules(db, { reportId: 60, issueType: 'Waste Disposal', area: 'Purok 2' });
    expect(result).toEqual({ priority: 'Low', recentCount: 2, raisedReportIds: [] });
    expect(db.calls).toHaveLength(2);
    expect(db.calls[0].params).toEqual(['Waste Disposal', 'Purok 2', RULES.PRIORITY_RAISE_DAYS]);
    expect(db.calls[1].params).toEqual(['Low', 60]);
  });

  test('3rd Waste Disposal report: the new one and the unresolved others become Medium', async () => {
    const db = fakeDb([
      [[{ recentCount: 3 }]], // count (including the new report)
      [{}], // UPDATE the new report
      [[{ id: 58, priority: 'Low' }, { id: 59, priority: 'Low' }]], // unresolved matching reports
      [{}], // UPDATE the others
    ]);
    const result = await applyPriorityRules(db, { reportId: 60, issueType: 'Waste Disposal', area: 'Purok 2' });
    expect(result).toEqual({ priority: 'Medium', recentCount: 3, raisedReportIds: [58, 59] });
    expect(db.calls[1].params).toEqual(['Medium', 60]);
    expect(db.calls[2].sql).toContain("status <> 'Resolved'");
    expect(db.calls[3].sql).toBe('UPDATE report SET priority = ? WHERE report_id IN (?, ?)');
    expect(db.calls[3].params).toEqual(['Medium', 58, 59]);
  });

  test('reports already at that level are not updated again', async () => {
    const db = fakeDb([[[{ recentCount: 4 }]], [{}], [[{ id: 58, priority: 'Medium' }]]]);
    const result = await applyPriorityRules(db, { reportId: 61, issueType: 'Waste Disposal', area: 'Purok 2' });
    expect(result.raisedReportIds).toEqual([]);
    expect(db.calls).toHaveLength(3);
  });

  test('Flooding is always High', async () => {
    const db = fakeDb([[[{ recentCount: 1 }]], [{}]]);
    const result = await applyPriorityRules(db, { reportId: 62, issueType: 'Flooding', area: 'Purok 4' });
    expect(result.priority).toBe('High');
  });
});
