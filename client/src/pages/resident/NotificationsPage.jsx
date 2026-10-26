/**
 * Resident notifications (/notifications), newest first.
 * - Unread items have a red dot.
 * - Tapping an item marks it as read, then opens its report.
 * - "Mark all as read" clears every red dot.
 * After each change the bottom-nav badge is updated with the server's count.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ResidentLayout from '../../layouts/ResidentLayout';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import Alert from '../../components/Alert';
import EmptyState from '../../components/EmptyState';
import LoadError from '../../components/LoadError';
import { apiRequest } from '../../api/client';
import { useLanguage } from '../../i18n/useLanguage';
import { useApiData } from '../../hooks/useApiData';
import { useUnreadCount } from '../../notifications/useUnreadCount';
import { formatDateTime } from '../../utils/format';
import { getNotificationIcon, getNotificationParts, getNotificationType } from '../../utils/notifications';
import './Notifications.css';

// Where a notification leads: its report, or - for a staff reply to a message
// the resident left - the Help panel (opened by ChatbotProvider).
function linkOf(item) {
  if (item.reportId) return { to: `/reports/${item.reportId}`, state: { from: '/notifications' } };
  return { to: '/home', state: { openHelp: true } };
}

export default function NotificationsPage() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { setUnreadCount } = useUnreadCount();
  const { data, loading, errorCode, reload } = useApiData('/resident/notifications');

  // Local copy so items can change from Unread to Read without reloading.
  const [items, setItems] = useState([]);
  const [markingAll, setMarkingAll] = useState(false);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    if (data) {
      setItems(data.notifications);
      setUnreadCount(data.unreadCount);
    }
  }, [data, setUnreadCount]);

  const unreadTotal = items.filter((item) => item.status === 'Unread').length;

  async function handleMarkAll() {
    setMarkingAll(true);
    setActionError(null);
    try {
      await apiRequest('/notifications/read-all', { method: 'PATCH' });
      setItems((current) => current.map((item) => ({ ...item, status: 'Read' })));
      setUnreadCount(0);
    } catch (error) {
      setActionError(error.code);
    } finally {
      setMarkingAll(false);
    }
  }

  // Unread item: mark it as read FIRST (so the badge is right), then open the report.
  async function handleOpen(event, item) {
    if (item.status !== 'Unread') return; // read items just follow the link
    event.preventDefault();
    try {
      const result = await apiRequest(`/notifications/${item.id}/read`, { method: 'PATCH' });
      setUnreadCount(result.unreadCount);
    } catch {
      // Still open the report; the item stays unread and can be marked later.
    }
    navigate(linkOf(item).to, { state: linkOf(item).state });
  }

  return (
    <ResidentLayout>
      <div className="notifications__header">
        <h1 className="page-title">{t('nav.notifications')}</h1>
        {items.length > 0 && (
          <Button variant="outline" icon="check" disabled={unreadTotal === 0 || markingAll} onClick={handleMarkAll}>
            {t('notifications.markAllRead')}
          </Button>
        )}
      </div>

      {actionError && <Alert type="error">{t(`errors.${actionError}`)}</Alert>}
      {loading && <p className="text-muted" role="status">{t('common.loading')}</p>}
      {!loading && errorCode && <LoadError code={errorCode} onRetry={reload} />}
      {!loading && !errorCode && items.length === 0 && (
        <EmptyState icon="bell" title={t('notifications.emptyTitle')} message={t('notifications.emptyMessage')} />
      )}

      {!loading && !errorCode && items.length > 0 && (
        <ul className="notifications__list">
          {items.map((item) => {
            const type = getNotificationType(item);
            const unread = item.status === 'Unread';
            const text = getNotificationParts(item, t);
            return (
              <li key={item.id}>
                <Link
                  to={linkOf(item).to}
                  state={linkOf(item).state}
                  className={`notification ${unread ? 'notification--unread' : ''}`}
                  onClick={(event) => handleOpen(event, item)}
                >
                  <span className={`notification__icon notification__icon--${type || 'other'}`}>
                    <Icon name={getNotificationIcon(type)} />
                  </span>
                  <span className="notification__body">
                    <span className="notification__message">
                      {text.before}
                      {text.reportId && <span className="notification__report-id">{text.reportId}</span>}
                      {text.after}
                    </span>
                    <span className="notification__date">{formatDateTime(item.dateSent, language)}</span>
                  </span>
                  {unread && (
                    <span className="notification__dot">
                      <span className="visually-hidden">{t('notifications.unread')}</span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </ResidentLayout>
  );
}
