/**
 * Page frame for response team and LGU pages:
 * dark green sidebar on the left (a drawer below 1024px), white top bar,
 * content on the right (max 1400px wide).
 *   role:      'response_team' or 'lgu'
 *   onLogout:  optional; by default "Log Out" ends the session.
 *   activeKey: optional; forces a menu item (and the top bar title), used by the preview.
 * The "staff-theme" class applies the staff look (StaffTheme.css) to
 * everything inside, so resident and public pages are not affected.
 */
import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar, { MENUS } from '../components/Sidebar';
import StaffTopBar from '../components/StaffTopBar';
import { useAuth } from '../auth/useAuth';
import { useLanguage } from '../i18n/useLanguage';
import './StaffLayout.css';
import './StaffTheme.css';

// IBM Plex Sans + Mono, loaded only for staff pages. Added without blocking the
// page: until it arrives (or if Google Fonts is unreachable) the system font shows.
const FONTS_URL = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap';

function useStaffFonts() {
  useEffect(() => {
    if (document.querySelector(`link[href="${FONTS_URL}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONTS_URL;
    document.head.appendChild(link);
  }, []);
}

export default function StaffLayout({ role, onLogout, activeKey, children }) {
  useStaffFonts();
  const { logout } = useAuth();
  const { t } = useLanguage();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  // Top bar title: the menu item of this page (Report Details -> "Reports").
  const titleKey = activeKey || (MENUS[role] || []).find((item) => pathname.startsWith(item.path))?.key;

  return (
    <div className="staff-layout staff-theme">
      <Sidebar
        role={role}
        onLogout={onLogout || (() => logout())}
        activeKey={activeKey}
        open={menuOpen}
        onClose={closeMenu}
      />
      <div className="staff-layout__body">
        <StaffTopBar role={role} title={titleKey ? t(`nav.${titleKey}`) : ''} menuOpen={menuOpen} onMenu={() => setMenuOpen(true)} />
        <main className="staff-layout__main">
          <div className="staff-layout__content">{children}</div>
        </main>
      </div>
    </div>
  );
}
