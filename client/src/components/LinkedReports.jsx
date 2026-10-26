/**
 * "Linked to similar report #2026-0040" lines on a report details page.
 *   reports:  [{ id, displayId }] from the API (only reports this user may open)
 *   basePath: where a report opens, e.g. '/admin/reports' -> /admin/reports/40
 * Links work both ways: the newer report links to the older one, and the
 * older one links back to every newer similar report.
 */
import { Link, useLocation } from 'react-router-dom';
import Icon from './Icon';
import { useLanguage } from '../i18n/useLanguage';
import './LinkedReports.css';

export default function LinkedReports({ reports, basePath }) {
  const { t } = useLanguage();
  const location = useLocation();
  if (!reports || reports.length === 0) return null;

  // Translated sentence split around the report number, which becomes the link.
  const [before, after = ''] = t('reportDetails.linkedTo', { id: '{id}' }).split('{id}');

  return (
    <ul className="linked-reports">
      {reports.map((report) => (
        <li key={report.id} className="linked-reports__item">
          <Icon name="link" size={20} />
          <span>
            {before}
            {/* Keep "Back" pointing to where the user came from before this report. */}
            <Link to={`${basePath}/${report.id}`} state={location.state} className="linked-reports__link">
              {report.displayId}
            </Link>
            {after}
          </span>
        </li>
      ))}
    </ul>
  );
}
