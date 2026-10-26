/**
 * Unit test: a CA certificate pasted into a hosting dashboard is rebuilt correctly. Run with:  npm test
 */
const { normalizePem } = require('./db');

// Not a real certificate: only the PEM layout matters here.
const BODY = 'MIIB'.padEnd(150, 'A') + '==';
const PEM = `-----BEGIN CERTIFICATE-----\n${BODY.match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----\n`;

describe('normalizePem', () => {
  test.each([
    ['as downloaded', PEM],
    ['line breaks turned into spaces', PEM.replace(/\n/g, ' ')],
    ['Windows line breaks', PEM.replace(/\n/g, '\r\n')],
    ['the two characters \\n', PEM.replace(/\n/g, '\\n')],
    ['extra indentation', PEM.split('\n').map((line) => `   ${line}  `).join('\n')],
  ])('%s -> standard PEM', (name, pasted) => {
    expect(normalizePem(pasted)).toBe(PEM);
  });

  test('keeps every certificate of a chain', () => {
    expect(normalizePem(`${PEM} ${PEM}`.replace(/\n/g, ' '))).toBe(PEM + PEM);
  });
});
