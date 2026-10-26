/**
 * Unit tests for the hotline and contact display rules. Run with:  npm test   (inside /server)
 */
const { telLink, publicHotlines, publicContact, hotlineWarnings } = require('./publicInfo');
const HOTLINES = require('../config/hotlines');

const SAMPLE = [
  { id: 'bfp', name: 'Fire', number: '(02) 8808-0617', mobile: ['0942 834 7377', '0936 470 2158'], verified: false, note: 'secret note', source: 'some site' },
  { id: 'pnp', name: 'Police', number: '[REPLACE]', verified: false },
  { id: 'national', name: 'National', number: '911', verified: true },
];

describe('publicHotlines', () => {
  const shown = publicHotlines(SAMPLE);

  test('911 is always first', () => {
    expect(shown[0].number).toBe('911');
  });

  test('entries with the number "[REPLACE]" are hidden', () => {
    expect(shown.map((h) => h.id)).toEqual(['national', 'bfp']);
  });

  test('unverified entries keep verified: false (shown as "To be confirmed")', () => {
    expect(shown.find((h) => h.id === 'bfp').verified).toBe(false);
    expect(shown.find((h) => h.id === 'national').verified).toBe(true);
  });

  test('every number and each mobile number gets its own tel: link without spaces or symbols', () => {
    const bfp = shown.find((h) => h.id === 'bfp');
    expect(bfp.tel).toBe('tel:0288080617');
    expect(bfp.mobile).toEqual([
      { number: '0942 834 7377', tel: 'tel:09428347377' },
      { number: '0936 470 2158', tel: 'tel:09364702158' },
    ]);
    expect(telLink('+63 917 123 4567')).toBe('tel:+639171234567');
  });

  test('"note" and "source" are never sent', () => {
    expect(JSON.stringify(shown)).not.toMatch(/note|source|secret/);
  });

  test('with the real config: 911 first, [REPLACE] entries hidden, no developer fields', () => {
    const real = publicHotlines(HOTLINES);
    expect(real[0].number).toBe('911');
    expect(real.some((h) => h.number.includes('[REPLACE]'))).toBe(false);
    expect(real.every((h) => !('note' in h) && !('source' in h))).toBe(true);
  });
});

describe('publicContact', () => {
  test('hides [REPLACE] fields and removes the [CONFIRM] marker', () => {
    const contact = publicContact({ address: '86 Landayan Street [CONFIRM]', phone: '(02) 8682244 [CONFIRM]', email: '[REPLACE]', facebook: 'https://facebook.com/x' });
    expect(contact).toEqual({ address: '86 Landayan Street', phone: '(02) 8682244', phoneTel: 'tel:028682244', facebook: 'https://facebook.com/x' });
  });
});

describe('hotlineWarnings', () => {
  test('lists every unverified or [REPLACE] hotline', () => {
    expect(hotlineWarnings(SAMPLE)).toEqual(['Fire: (02) 8808-0617 is not verified', 'Police: number is [REPLACE] (hidden)']);
  });
});
