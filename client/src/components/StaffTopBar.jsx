/**
 * White top bar for LGU and response team pages:
 *   left:  menu button (below 1024px) and the page title
 *   right: date and time in Asia/Manila, EN | TL switch, notification bell
 */
import { useEffect, useState } from 'react';
import Icon from './Icon';
import LanguageSwitch from './LanguageSwitch';
import NotificationBell from './NotificationBell';
import { useLanguage } from '../i18n/useLanguage';
import './StaffTopBar.css';

const TIME_ZONE = 'Asia/Manila';
const LOCALES = { en: 'en-US', tl: 'fil-PH' };

// "Mon, Oct 26, 2026 · 11:06 AM" in Manila time, whatever the computer's time zone.
function manilaClock(now, language) {
  const locale = LOCALES[language] || 'en-US';
  const date = new Intl.DateTimeFormat(locale, { timeZone: TIME_ZONE, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(now);
  const time = new Intl.DateTimeFormat(locale, { timeZone: TIME_ZONE, hour: 'numeric', minute: '2-digit' }).format(now);
  return `${date} · ${time}`;
}

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export default function StaffTopBar({ role, title, menuOpen, onMenu }) {
  const { t, language } = useLanguage();
  const now = useNow();

  return (
    <header className="topbar">
      <button
        type="button"
        className="topbar__icon-button topbar__menu"
        aria-label={t('staffShell.openMenu')}
        aria-expanded={menuOpen}
        aria-controls="staff-sidebar"
        onClick={onMenu}
      >
        <Icon name="menu" size={20} />
      </button>
      <p className="topbar__title">{title}</p>

      <div className="topbar__right">
        <time className="topbar__clock" dateTime={now.toISOString()} title={t('staffShell.currentTime')}>
          {manilaClock(now, language)}
        </time>
        <LanguageSwitch />
        <NotificationBell role={role} />
      </div>
    </header>
  );
}
