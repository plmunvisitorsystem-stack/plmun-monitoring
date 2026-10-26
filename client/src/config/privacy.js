/**
 * Details for the Data Privacy Notice (/privacy) that only Barangay Landayan
 * can give. Replace every "[REPLACE]" before the system is used.
 * Until then, the notice says "to be announced / to be confirmed" and points
 * residents to the barangay office (the markers are never shown).
 */
export const DATA_PROTECTION_OFFICER = {
  name: '[REPLACE]',
  email: '[REPLACE]',
  phone: '[REPLACE]',
};

// How long accounts, reports, and photos are kept, e.g. "5 years after the account is closed".
export const RETENTION_PERIOD = '[REPLACE]';

export const isPlaceholder = (value) => !value || String(value).includes('[REPLACE]');
