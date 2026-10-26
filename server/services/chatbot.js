/**
 * Rule-based chatbot: finds which menu option a typed message is about.
 * All words and the menu come from config/chatbotRules.js (no AI).
 *
 *   matchIntent('Ano ang estado ng ulat ko?')  -> 'myStatus'
 *   matchIntent('hello')                       -> null (not understood)
 */
const RULES = require('../config/chatbotRules');

/**
 * Lower case, no accents, letters and numbers only (everything else -> space).
 * "Emerhénsiya!" -> "emerhensiya"; "mag-ulat" -> "mag ulat"
 */
function normalize(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove accents
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim();
}

/** True when the keyword appears in the text as whole word(s). */
function containsKeyword(normalizedText, keyword) {
  const word = normalize(keyword);
  return word !== '' && ` ${normalizedText} `.includes(` ${word} `);
}

/**
 * The option id for a typed message, or null if nothing matches.
 *   1. emergency first (safety)
 *   2. phrases (2+ words) in MATCH_ORDER
 *   3. single words in MATCH_ORDER
 */
function matchIntent(text, rules = RULES) {
  const message = normalize(text);
  if (!message) return null;

  const matches = (option, phrases) =>
    rules.KEYWORDS[option].some((keyword) => normalize(keyword).includes(' ') === phrases && containsKeyword(message, keyword));

  if (rules.KEYWORDS.emergency && (matches('emergency', true) || matches('emergency', false))) return 'emergency';
  for (const phrases of [true, false]) {
    const found = rules.MATCH_ORDER.find((option) => matches(option, phrases));
    if (found) return found;
  }
  return null;
}

module.exports = { normalize, containsKeyword, matchIntent };
