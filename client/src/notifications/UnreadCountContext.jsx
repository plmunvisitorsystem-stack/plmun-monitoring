/**
 * Keeps the resident's number of Unread notifications for the badge on the
 * "Notifications" tab. It reloads the number:
 *   - whenever the resident opens another page
 *   - when the browser tab becomes visible again
 * The Notifications page also sets it directly after marking items as read.
 */
import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { apiRequest } from '../api/client';

export const UnreadCountContext = createContext(null);

/** Used in App.jsx as a parent route around all resident pages. */
export function UnreadCountProvider() {
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const data = await apiRequest('/resident/notifications');
      setUnreadCount(data.unreadCount);
    } catch {
      // Keep the old number; the page itself shows any connection error.
    }
  }, []);

  useEffect(() => {
    refreshUnreadCount();
  }, [location.pathname, refreshUnreadCount]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshUnreadCount();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refreshUnreadCount]);

  const value = useMemo(
    () => ({ unreadCount, setUnreadCount, refreshUnreadCount }),
    [unreadCount, refreshUnreadCount],
  );

  return (
    <UnreadCountContext.Provider value={value}>
      <Outlet />
    </UnreadCountContext.Provider>
  );
}
