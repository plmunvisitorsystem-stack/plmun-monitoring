/**
 * Centered card used by the Login and Register pages, on top of the barangay hall photo:
 * logo, system name, subtitle, and the language dropdown on top.
 *   priorityPhoto: true on the Login page so its background photo is preloaded.
 */
import Logo from '../components/Logo';
import HallPhoto from '../components/HallPhoto';
import LanguageSelect from '../components/LanguageSelect';
import { useLanguage } from '../i18n/useLanguage';
import './AuthLayout.css';

export default function AuthLayout({ children, priorityPhoto = false }) {
  const { t } = useLanguage();

  return (
    <div className="auth-page hall-bg">
      <HallPhoto priority={priorityPhoto} />
      <main className="auth-card">
        <div className="auth-card__brand">
          <Logo size={80} loading="eager" />
          <h1 className="auth-card__title">{t('app.title')}</h1>
          <p className="text-muted">{t('app.subtitle')}</p>
        </div>
        <LanguageSelect />
        <hr className="auth-card__divider" />
        {children}
      </main>
    </div>
  );
}
