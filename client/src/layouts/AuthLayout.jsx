/**
 * Page frame for Login and Register:
 *   desktop: barangay hall photo panel on the left, the form on the right
 *   phones:  a short photo banner on top, the form below it
 *   priorityPhoto: true on the Login page so its background photo is preloaded.
 */
import { Link } from 'react-router-dom';
import Logo from '../components/Logo';
import HallPhoto from '../components/HallPhoto';
import LanguageSwitch from '../components/LanguageSwitch';
import SkipLink from '../components/SkipLink';
import { useLanguage } from '../i18n/useLanguage';
import './AuthLayout.css';

export default function AuthLayout({ children, priorityPhoto = false }) {
  const { t } = useLanguage();

  return (
    <div className="auth-page">
      <SkipLink />
      <header className="auth-panel hall-bg">
        <HallPhoto priority={priorityPhoto} sizes="(min-width: 900px) 45vw, 100vw" />
        <div className="auth-panel__top">
          <LanguageSwitch />
        </div>
        <div className="auth-panel__brand">
          <Logo size={80} loading="eager" className="auth-panel__logo" />
          <div>
            <p className="auth-panel__title">{t('app.title')}</p>
            <p className="auth-panel__subtitle">{t('app.subtitle')}</p>
          </div>
          <p className="auth-panel__text">{t('auth.panelText')}</p>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="auth-main">
        <div className="auth-main__inner">
          {children}
          <p className="auth-main__links">
            <Link to="/">{t('auth.backHome')}</Link>
            <Link to="/privacy">{t('privacy.title')}</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
