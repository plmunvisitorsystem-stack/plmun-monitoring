/**
 * Red "Overdue" tag shown next to the status of a report that is not Resolved
 * and was submitted more than OVERDUE_DAYS days ago (the server decides:
 * report.isOverdue). Clock icon + word, so it never relies on color alone.
 */
import Icon from './Icon';
import { useLanguage } from '../i18n/useLanguage';
import './OverdueTag.css';

export default function OverdueTag() {
  const { t } = useLanguage();
  return (
    <span className="overdue-tag">
      <Icon name="clock" size={16} />
      <span>{t('overdue.tag')}</span>
    </span>
  );
}
