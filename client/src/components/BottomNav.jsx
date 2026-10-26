/**
 * Bottom navigation for resident pages (mobile-first):
 * Home, Report, Notifications, Profile.
 * The Notifications tab shows a red badge with the number of Unread notifications.
 *   activeKey: optional; forces an item to look active (used by the preview).
 *              Normally the active item comes from the current URL.
 */
import { NavLink } from 'react-router-dom';
import Icon from './Icon';
import { useLanguage } from '../i18n/useLanguage';
import { useUnreadCount } from '../notifications/useUnreadCount';
import './BottomNav.css';

const ITEMS = [
  { key: 'home', path: '/home', icon: 'home' },
  { key: 'report', path: '/report', icon: 'report' },
  { key: 'notifications', path: '/notifications', icon: 'bell' },
  { key: 'profile', path: '/profile', icon: 'user' },
];

export default function BottomNav({ activeKey, className = '' }) {
  const { t } = useLanguage();
  const { unreadCount } = useUnreadCount();

  return (
    <nav className={`bottom-nav ${className}`} aria-label={t('nav.mainMenu')}>
      <ul className="bottom-nav__list">
        {ITEMS.map((item) => {
          const showBadge = item.key === 'notifications' && unreadCount > 0;
          return (
            <li key={item.key}>
              <NavLink
                to={item.path}
                end
                className={({ isActive }) => {
                  const active = activeKey ? activeKey === item.key : isActive;
                  return `bottom-nav__link ${active ? 'is-active' : ''}`;
                }}
              >
                <span className="bottom-nav__icon">
                  <Icon name={item.icon} />
                  {showBadge && (
                    <span className="bottom-nav__badge" aria-hidden="true">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </span>
                <span>{t(`nav.${item.key}`)}</span>
                {showBadge && (
                  <span className="visually-hidden">{t('notifications.unreadCount', { count: unreadCount })}</span>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
