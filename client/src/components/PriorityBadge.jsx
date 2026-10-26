/**
 * Priority badge: an OUTLINED pill with a flag icon, so it never looks like
 * a (filled) status badge. Always shows the word, never color alone.
 *   High: red  ·  Medium: amber  ·  Low: gray-green
 *   priority: the English database value ('High' | 'Medium' | 'Low')
 */
import Icon from './Icon';
import { useLanguage } from '../i18n/useLanguage';
import { PRIORITY_KEYS } from '../utils/constants';
import './PriorityBadge.css';

export default function PriorityBadge({ priority }) {
  const { t } = useLanguage();
  const key = PRIORITY_KEYS[priority] || 'low';

  return (
    <span className={`priority-badge priority-badge--${key}`} title={t('priority.title')}>
      <Icon name="flag" size={16} />
      <span>{t(`priority.${key}`)}</span>
    </span>
  );
}
