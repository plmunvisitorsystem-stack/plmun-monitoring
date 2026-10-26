/**
 * Public hotlines and contact details (config/hotlines.js, config/contact.js),
 * prepared for the landing page and the chatbot "Emergency" answer.
 *
 * Hotline rules:
 *   - 911 is always first
 *   - an entry whose number is "[REPLACE]" is hidden
 *   - unverified entries keep verified: false (the client shows "To be confirmed")
 *   - every number gets a tel: link (spaces and symbols removed); each mobile number separately
 *   - "note" and "source" are for the developers only and are never sent
 * Contact rules:
 *   - a field containing "[REPLACE]" is hidden
 *   - "[CONFIRM]" is removed from the text that is shown
 *
 * The functions are pure (they get the lists), so they are easy to unit test
 * (publicInfo.test.js).
 */
const REPLACE = '[REPLACE]';
const CONFIRM = '[CONFIRM]';

// "(02) 8808-0617" -> "tel:0288080617"; keeps a leading "+".
function telLink(number) {
  const text = String(number).trim();
  return `tel:${text.startsWith('+') ? '+' : ''}${text.replace(/[^0-9]/g, '')}`;
}

const isReplace = (value) => typeof value === 'string' && value.includes(REPLACE);

function publicHotlines(list) {
  const shown = list
    .filter((item) => item && typeof item.number === 'string' && !isReplace(item.number))
    .map((item) => ({
      id: item.id,
      name: item.name,
      number: item.number,
      tel: telLink(item.number),
      mobile: (item.mobile || []).filter((m) => !isReplace(m)).map((m) => ({ number: m, tel: telLink(m) })),
      ...(item.address && !isReplace(item.address) ? { address: item.address.replace(CONFIRM, '').trim() } : {}),
      verified: item.verified === true,
    }));
  // 911 first; the others keep their order from the config file.
  return [...shown.filter((h) => h.number === '911'), ...shown.filter((h) => h.number !== '911')];
}

function publicContact(contact) {
  const result = {};
  for (const [key, value] of Object.entries(contact)) {
    if (typeof value !== 'string' || isReplace(value) || !value.trim()) continue;
    result[key] = value.replace(CONFIRM, '').trim();
  }
  if (result.phone) result.phoneTel = telLink(result.phone);
  return result;
}

/** Lines for the server console: hotlines that are unverified or still "[REPLACE]". */
function hotlineWarnings(list) {
  return list
    .filter((item) => isReplace(item.number) || item.verified !== true)
    .map((item) => `${item.name}: ${isReplace(item.number) ? 'number is [REPLACE] (hidden)' : `${item.number} is not verified`}`);
}

module.exports = { telLink, publicHotlines, publicContact, hotlineWarnings };
