/**
 * Language (i18n) system.
 *
 * - All on-screen text lives in en.json and tl.json.
 * - Components get text with t('group.key'), e.g. t('nav.home').
 * - The chosen language is saved in localStorage so it stays after a refresh.
 *
 * Use the useLanguage() hook (useLanguage.js) inside components.
 */
import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import en from './en.json';
import tl from './tl.json';

const dictionaries = { en, tl };
export const SUPPORTED_LANGUAGES = ['en', 'tl'];
const STORAGE_KEY = 'language';

// Reads the saved language. localStorage can throw (e.g. private mode),
// so we fall back to English if anything goes wrong.
function readSavedLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return SUPPORTED_LANGUAGES.includes(saved) ? saved : 'en';
  } catch {
    return 'en';
  }
}

// Finds a nested value: lookup(en, 'nav.home') -> en.nav.home
function lookup(dictionary, key) {
  return key.split('.').reduce(
    (value, part) => (value && value[part] !== undefined ? value[part] : undefined),
    dictionary,
  );
}

export const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(readSavedLanguage);

  // Changes the language and saves the choice.
  const setLanguage = useCallback((newLanguage) => {
    if (!SUPPORTED_LANGUAGES.includes(newLanguage)) return;
    setLanguageState(newLanguage);
    try {
      localStorage.setItem(STORAGE_KEY, newLanguage);
    } catch {
      // Saving failed (storage blocked); the switch still works until refresh.
    }
  }, []);

  /**
   * Translates a key. Values in {curly braces} are replaced:
   *   t('home.greeting', { name: 'Juan' }) -> "Good day, Juan!"
   * If a Tagalog text is missing, the English text is used instead.
   */
  const t = useCallback(
    (key, values = {}) => {
      const text = lookup(dictionaries[language], key) ?? lookup(en, key);
      if (typeof text !== 'string') {
        if (import.meta.env.DEV) console.warn(`Missing translation: ${key}`);
        return key;
      }
      return text.replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match);
    },
    [language],
  );

  // Keep the <html lang> attribute and the browser tab title in sync.
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = t('app.title');
  }, [language, t]);

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
