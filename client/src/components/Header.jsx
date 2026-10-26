/**
 * Green header shown at the top of every page:
 * logo, app title, subtitle, and the EN | TL language switch.
 * (Response team and LGU pages use StaffTopBar instead.)
 */
import Logo from './Logo';
import LanguageSwitch from './LanguageSwitch';
import { useLanguage } from '../i18n/useLanguage';
import './Header.css';

export default function Header() {
  const { t } = useLanguage();

  return (
    <header className="app-header">
      <div className="app-header__brand">
        <span className="app-header__logo">
          <Logo size={32} loading="eager" />
        </span>
        <div className="app-header__text">
          <p className="app-header__title">{t('app.title')}</p>
          <p className="app-header__subtitle">{t('app.subtitle')}</p>
        </div>
      </div>
      <LanguageSwitch />
    </header>
  );
}
