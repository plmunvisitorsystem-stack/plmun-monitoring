/**
 * Five summary cards: Total Reports, Submitted, Under Review, In Progress, Resolved.
 * Each card has an icon, a label, and the number, so the status is never
 * shown by color alone.
 */
import Icon from '../Icon';
import { useLanguage } from '../../i18n/useLanguage';
import { STATUSES, STATUS_KEYS } from '../../utils/constants';

const STATUS_ICONS = {
  Submitted: 'send',
  'Under Review': 'eye',
  'In Progress': 'clock',
  Resolved: 'checkCircle',
};

export default function SummaryCards({ total, byStatus }) {
  const { t } = useLanguage();

  const cards = [
    { key: 'total', label: t('dashboard.totalReports'), value: total, icon: 'file' },
    ...STATUSES.map((status) => ({
      key: STATUS_KEYS[status],
      label: t(`status.${STATUS_KEYS[status]}`),
      value: byStatus[status],
      icon: STATUS_ICONS[status],
    })),
  ];

  return (
    <ul className="summary-cards">
      {cards.map((card) => (
        <li key={card.key} className={`summary-card summary-card--${card.key}`}>
          <span className="summary-card__icon">
            <Icon name={card.icon} />
          </span>
          <span className="summary-card__label">{card.label}</span>
          <span className="summary-card__value">{card.value}</span>
        </li>
      ))}
    </ul>
  );
}
