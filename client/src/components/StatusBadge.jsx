/**
 * Colored badge that shows a report status.
 *   status: the English database value, e.g. 'In Progress'
 * The badge always shows the translated word, never only a color.
 */
import { useLanguage } from '../i18n/useLanguage';
import { STATUS_KEYS } from '../utils/constants';
import './StatusBadge.css';

export default function StatusBadge({ status }) {
  const { t } = useLanguage();
  const key = STATUS_KEYS[status];

  // Unknown value: show it as-is in gray instead of crashing.
  if (!key) {
    return <span className="status-badge status-badge--submitted">{status}</span>;
  }

  return <span className={`status-badge status-badge--${key}`}>{t(`status.${key}`)}</span>;
}
