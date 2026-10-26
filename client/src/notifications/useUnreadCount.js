/**
 * Hook for the unread notification count:
 *   const { unreadCount, setUnreadCount } = useUnreadCount();
 * Outside resident pages (e.g. the design preview) it returns 0.
 */
import { useContext } from 'react';
import { UnreadCountContext } from './UnreadCountContext';

const NO_PROVIDER = { unreadCount: 0, setUnreadCount: () => {}, refreshUnreadCount: () => {} };

export function useUnreadCount() {
  return useContext(UnreadCountContext) || NO_PROVIDER;
}
