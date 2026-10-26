/**
 * "Recent Reports" - the 5 newest reports in the dashboard's scope.
 *   viewAllPath: where "View All" goes
 *   detailsPath: function(id) -> link for "View", or null for no View column
 */
import { Link } from 'react-router-dom';
import Icon from '../Icon';
import IssueTypeIcon from '../IssueTypeIcon';
import ReportStatus from '../ReportStatus';
import { useLanguage } from '../../i18n/useLanguage';
import { formatDate, formatReportId } from '../../utils/format';
import '../Button.css';
import '../ReportTable.css';

export default function RecentReportsTable({ reports, viewAllPath, detailsPath }) {
  const { t, language } = useLanguage();

  return (
    <section className="dashboard__recent">
      <div className="dashboard__section-header">
        <h2 className="section-title">{t('dashboard.recentReports')}</h2>
        <Link to={viewAllPath} className="dashboard__view-all">
          <span>{t('home.viewAll')}</span>
          <Icon name="chevronRight" size={20} />
        </Link>
      </div>

      {reports.length === 0 ? (
        <p className="text-muted">{t('teamReports.emptyTitle')}</p>
      ) : (
        <div className="team-table-wrap">
          <table className="team-table">
            <thead>
              <tr>
                <th scope="col">{t('teamReports.reportId')}</th>
                <th scope="col">{t('submitReport.issueType')}</th>
                <th scope="col">{t('fields.location')}</th>
                <th scope="col" className="team-table__date">{t('reportDetails.dateSubmitted')}</th>
                <th scope="col">{t('teamReports.status')}</th>
                {detailsPath && (
                  <th scope="col">
                    <span className="visually-hidden">{t('teamReports.action')}</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => {
                const displayId = formatReportId(report.id, report.dateSubmitted);
                return (
                  <tr key={report.id}>
                    <td data-label={t('teamReports.reportId')} className="team-table__id">{displayId}</td>
                    <td data-label={t('submitReport.issueType')}>
                      <IssueTypeIcon type={report.issueType} />
                    </td>
                    <td data-label={t('fields.location')}>{report.location}</td>
                    <td data-label={t('reportDetails.dateSubmitted')} className="team-table__date">{formatDate(report.dateSubmitted, language)}</td>
                    <td data-label={t('teamReports.status')}>
                      <ReportStatus status={report.status} isOverdue={report.isOverdue} />
                    </td>
                    {detailsPath && (
                      <td className="team-table__action">
                        <Link
                          to={detailsPath(report.id)}
                          className="btn btn--outline team-table__view"
                          aria-label={t('teamReports.viewReport', { id: displayId })}
                        >
                          <Icon name="eye" size={20} />
                          <span>{t('teamReports.view')}</span>
                        </Link>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
