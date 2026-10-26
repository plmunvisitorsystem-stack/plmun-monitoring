/**
 * EN | TL language switch shown in the header on every page.
 * The selected button is highlighted; the choice is saved by useLanguage().
 */
import { useLanguage } from '../i18n/useLanguage';
import { SUPPORTED_LANGUAGES } from '../i18n/LanguageContext';
import './LanguageSwitch.css';

export default function LanguageSwitch() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="lang-switch" role="group" aria-label={t('language.switchLabel')}>
      {SUPPORTED_LANGUAGES.map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          className="lang-switch__option"
          aria-pressed={language === code}
          title={t(`language.${code}Name`)}
          onClick={() => setLanguage(code)}
        >
          {t(`language.${code}`)}
        </button>
      ))}
    </div>
  );
}
