/**
 * "Choose Language / Pumili ng Wika" dropdown for the Login and Register pages.
 * Works the same as the EN | TL switch in the header (saved in localStorage).
 */
import { useId } from 'react';
import { useLanguage } from '../i18n/useLanguage';
import { SUPPORTED_LANGUAGES } from '../i18n/LanguageContext';
import './Input.css';

export default function LanguageSelect() {
  const { language, setLanguage, t } = useLanguage();
  const id = useId();

  return (
    <div className="field">
      <label htmlFor={id} className="field__label">
        {t('auth.chooseLanguage')}
      </label>
      <select
        id={id}
        className="field__control"
        value={language}
        onChange={(event) => setLanguage(event.target.value)}
      >
        {SUPPORTED_LANGUAGES.map((code) => (
          <option key={code} value={code} lang={code}>
            {t(`language.${code}Option`)}
          </option>
        ))}
      </select>
    </div>
  );
}
