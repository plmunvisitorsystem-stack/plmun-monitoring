/**
 * Resident home page (/home):
 * greeting banner on the barangay hall photo, "Report a Concern" button, and the 5 newest reports.
 * "View All" appears when the resident has more than 5 reports.
 */
import { Link } from 'react-router-dom';
import ResidentLayout from '../../layouts/ResidentLayout';
import Icon from '../../components/Icon';
import HallPhoto from '../../components/HallPhoto';
import ReportCard from '../../components/ReportCard';
import EmptyState from '../../components/EmptyState';
import LoadError from '../../components/LoadError';
import { useAuth } from '../../auth/useAuth';
import { useLanguage } from '../../i18n/useLanguage';
import { useApiData } from '../../hooks/useApiData';
import '../../components/Button.css';
import './Resident.css';

const HOME_LIMIT = 5;

export default function HomePage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data, loading, errorCode, reload } = useApiData('/resident/reports');

  const reports = data?.reports || [];
  const firstName = user.name.trim().split(/\s+/)[0];

  return (
    <ResidentLayout>
      <div className="home__banner hall-bg">
        <HallPhoto sizes="(min-width: 600px) 560px, 100vw" />
        <h1 className="page-title">{t('home.greeting', { name: firstName })}</h1>
        <p className="home__subtitle">{t('home.subtitle')}</p>
      </div>

      <Link to="/report" className="btn btn--primary btn--full home__cta">
        <Icon name="report" size={28} />
        <span>{t('actions.reportConcern')}</span>
      </Link>

      <section className="home__reports">
        <div className="section-header">
          <h2 className="section-title">{t('home.myReports')}</h2>
          {reports.length > HOME_LIMIT && (
            <Link to="/reports" className="section-header__link">
              <span>{t('home.viewAll')}</span>
              <Icon name="chevronRight" size={20} />
            </Link>
          )}
        </div>

        {loading && <p className="text-muted" role="status">{t('common.loading')}</p>}
        {!loading && errorCode && <LoadError code={errorCode} onRetry={reload} />}
        {!loading && !errorCode && reports.length === 0 && (
          <EmptyState title={t('empty.noReportsTitle')} message={t('empty.noReportsMessage')} />
        )}
        {!loading && !errorCode && reports.length > 0 && (
          <ul className="report-list">
            {reports.slice(0, HOME_LIMIT).map((report) => (
              <li key={report.id}>
                <ReportCard report={report} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </ResidentLayout>
  );
}
