/**
 * Unit tests for registration: the Data Privacy consent is required. Run with:  npm test
 */
const { validateRegistration } = require('./validators');

const VALID = {
  name: 'Juan Dela Cruz',
  address: 'Purok 1, Rosal Street',
  contactInfo: '0917 123 4567',
  username: 'juan.test',
  password: 'Password123!',
  confirmPassword: 'Password123!',
  privacyConsent: true,
};

describe('validateRegistration - Data Privacy consent', () => {
  test('valid form with consent has no errors', () => {
    expect(validateRegistration(VALID).errors).toEqual({});
  });

  test('missing consent is refused', () => {
    const { privacyConsent, ...noConsent } = VALID;
    expect(validateRegistration(noConsent).errors).toEqual({ privacyConsent: 'CONSENT_REQUIRED' });
  });

  test('consent must be exactly true (not "true", 1, or "on")', () => {
    for (const value of [false, 'true', 1, 'on', null]) {
      expect(validateRegistration({ ...VALID, privacyConsent: value }).errors).toEqual({ privacyConsent: 'CONSENT_REQUIRED' });
    }
  });
});
