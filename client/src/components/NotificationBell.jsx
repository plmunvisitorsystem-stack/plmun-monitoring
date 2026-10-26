/**
 * Notification bell for LGU and response team accounts (staff top bar).
 * Shows the unread count; clicking opens a list of the newest notifications.
 * Clicking a notification marks it Read and opens the report (or Live Chat).
 * The list reloads when the page changes, every minute, and when the
 * browser tab becomes visible again.
 *   role: 'lgu' or 'response_team' (decides the links)
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Icon from './Icon';
import { apiRequest } from '../api/client';
import { useLanguage } from '../i18n/useLanguage';
import { formatDateTime, formatReportId } from '../utils/format';
import { ISSUE_TYPE_KEYS, STATUS_KEYS } from '../utils/constants';

const REFRESH_MS = 60000;

export default function NotificationBell({ role }) {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const panelId = useId();
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ notifications: [], unreadCount: 0 });

  const load = useCallback(() => {
    apiRequest('/staff/notifications')
      .then(setData)
      .catch(() => {}); // keep the old list; pages show their own connection errors
  }, []);

  useEffect(() => {
    load();
  }, [load, location.pathname]);

  useEffect(() => {
    const timer = setInterval(load, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  // Close with Esc (focus goes back to the bell) or a click outside.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onClick = (event) => {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  const base = role === 'lgu' ? '/admin' : '/team';

  function messageFor(item) {
    const id = item.reportId ? formatReportId(item.reportId, item.reportDateSubmitted) : '';
    const issueType = item.issueType ? t(`issueType.${ISSUE_TYPE_KEYS[item.issueType]}`) : '';
    const status = item.detail && STATUS_KEYS[item.detail] ? t(`status.${STATUS_KEYS[item.detail]}`) : item.detail;
    return t(`staffNotifications.${item.type}`, { id, issueType, status });
  }

  function openItem(item) {
    setOpen(false);
    if (item.status === 'Unread') {
      apiRequest(`/staff/notifications/${item.id}/read`, { method: 'PATCH' })
        .then(({ unreadCount }) =>
          setData((current) => ({
            unreadCount,
            notifications: current.notifications.map((n) => (n.id === item.id ? { ...n, status: 'Read' } : n)),
          })),
        )
        .catch(() => {});
    }
    navigate(item.reportId ? `${base}/reports/${item.reportId}` : `${base}/live-chat`);
  }

  async function markAllRead() {
    try {
      await apiRequest('/staff/notifications/read-all', { method: 'PATCH' });
      setData((current) => ({ unreadCount: 0, notifications: current.notifications.map((n) => ({ ...n, status: 'Read' })) }));
    } catch {
      // nothing changed; the next reload shows the real state
    }
  }

  const { notifications, unreadCount } = data;

  return (
    <div className="bell" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className="topbar__icon-button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={unreadCount > 0 ? t('staffNotifications.bellUnread', { count: unreadCount }) : t('staffNotifications.bellLabel')}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="bell" size={20} />
        {unreadCount > 0 && (
          <span className="bell__count" aria-hidden="true">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div id={panelId} className="bell__panel" role="region" aria-label={t('staffNotifications.title')}>
          <div className="bell__header">
            <h2 className="bell__title">{t('staffNotifications.title')}</h2>
            {unreadCount > 0 && (
              <button type="button" className="bell__mark-all" onClick={markAllRead}>
                {t('staffNotifications.markAllRead')}
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="bell__empty">
              <Icon name="bell" size={16} />
              <span>{t('staffNotifications.none')}</span>
            </p>
          ) : (
            <ul className="bell__list">
              {notifications.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`bell__item ${item.status === 'Unread' ? 'is-unread' : ''}`}
                    onClick={() => openItem(item)}
                  >
                    <span className="bell__message">
                      {item.status === 'Unread' && <span className="visually-hidden">{t('staffNotifications.unread')}: </span>}
                      {messageFor(item)}
                    </span>
                    <span className="bell__time">{formatDateTime(item.dateSent, language)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
