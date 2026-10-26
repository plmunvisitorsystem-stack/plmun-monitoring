/**
 * Icon + translated label for an issue type.
 *   type: the English database value, e.g. 'Flooding'
 * Icons: Waste Disposal = trash, Pollution = smoke cloud,
 *        Flooding = water waves, Other Hazard = warning triangle.
 */
import Icon from './Icon';
import { useLanguage } from '../i18n/useLanguage';
import { ISSUE_TYPE_ICONS, ISSUE_TYPE_KEYS } from '../utils/constants';
import './IssueTypeIcon.css';

export default function IssueTypeIcon({ type }) {
  const { t } = useLanguage();
  const key = ISSUE_TYPE_KEYS[type];

  return (
    <span className="issue-type">
      <span className="issue-type__icon">
        <Icon name={ISSUE_TYPE_ICONS[type] || 'warning'} />
      </span>
      <span className="issue-type__label">{key ? t(`issueType.${key}`) : type}</span>
    </span>
  );
}
