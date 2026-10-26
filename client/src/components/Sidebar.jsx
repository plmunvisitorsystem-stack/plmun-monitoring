/**
 * Dark green left sidebar for response team and LGU pages.
 *   role:      'response_team' or 'lgu' (decides which menu items show)
 *   onLogout:  function called when "Log Out" is clicked
 *   activeKey: optional; forces an item to look active (used by the preview).
 *   open / onClose: below 1024px the sidebar is a drawer opened from the top bar's menu button.
 * Top: logo + system name. Bottom: the logged-in name, role, and Log Out.
 */
import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import Icon from './Icon';
import Logo from './Logo';
import { useAuth } from '../auth/useAuth';
import { useLanguage } from '../i18n/useLanguage';
import './Sidebar.css';

export const MENUS = {
  response_team: [
    { key: 'dashboard', path: '/team/dashboard', icon: 'dashboard' },
    { key: 'reports', path: '/team/reports', icon: 'list' },
    { key: 'liveChat', path: '/team/live-chat', icon: 'chat' },
    { key: 'profile', path: '/team/profile', icon: 'user' },
  ],
  lgu: [
    { key: 'dashboard', path: '/admin/dashboard', icon: 'dashboard' },
    { key: 'reports', path: '/admin/reports', icon: 'list' },
    { key: 'manageUsers', path: '/admin/users', icon: 'users' },
    { key: 'featuredCases', path: '/admin/featured-cases', icon: 'star' },
    { key: 'performance', path: '/admin/performance', icon: 'chart' },
    { key: 'generateReports', path: '/admin/generate-reports', icon: 'file' },
    { key: 'liveChat', path: '/admin/live-chat', icon: 'chat' },
    { key: 'chatSchedule', path: '/admin/chat-schedule', icon: 'calendar' },
    { key: 'profile', path: '/admin/profile', icon: 'user' },
  ],
};

export default function Sidebar({ role, onLogout, activeKey, open = false, onClose }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const items = MENUS[role] || [];

  // Esc closes the drawer (phones and tablets).
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} aria-hidden="true" />}
      <aside id="staff-sidebar" className={`sidebar ${open ? 'is-open' : ''}`}>
        <div className="sidebar__brand">
          <span className="sidebar__logo">
            <Logo size={40} loading="eager" />
          </span>
          <span className="sidebar__brand-name">{t('app.title')}</span>
          <button type="button" className="sidebar__close" onClick={onClose} aria-label={t('staffShell.closeMenu')}>
            <Icon name="close" size={20} />
          </button>
        </div>

        <nav className="sidebar__nav" aria-label={t('nav.mainMenu')}>
          <ul className="sidebar__list">
            {items.map((item) => (
              <li key={item.key}>
                <NavLink
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) => {
                    const active = activeKey ? activeKey === item.key : isActive;
                    return `sidebar__link ${active ? 'is-active' : ''}`;
                  }}
                >
                  <Icon name={item.icon} size={16} />
                  <span>{t(`nav.${item.key}`)}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="sidebar__account">
          {user && (
            <p className="sidebar__user">
              <span className="sidebar__user-name">{user.name}</span>
              <span className="sidebar__user-role">{t(role === 'lgu' ? 'staffShell.roleLgu' : 'staffShell.roleTeam')}</span>
            </p>
          )}
          <button type="button" className="sidebar__link" onClick={onLogout}>
            <Icon name="logout" size={16} />
            <span>{t('nav.logOut')}</span>
          </button>
        </div>
      </aside>
    </>
  );
}
