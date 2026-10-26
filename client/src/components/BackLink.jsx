/**
 * "Back" link with an arrow, shown at the top of inner pages.
 *   to: where to go back to
 */
import { Link } from 'react-router-dom';
import Icon from './Icon';
import { useLanguage } from '../i18n/useLanguage';
import './BackLink.css';

export default function BackLink({ to }) {
  const { t } = useLanguage();

  return (
    <Link to={to} className="back-link">
      <Icon name="arrowLeft" size={20} />
      <span>{t('common.back')}</span>
    </Link>
  );
}
