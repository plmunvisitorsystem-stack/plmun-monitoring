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
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import LoadError from '../../components/LoadError';
import { useAuth } from '../../auth/useAuth';
import { useLanguage } from '../../i18n/useLanguage';
import { useApiData } from '../../hooks/useApiData';
import '../../components/Button.css';
import './Resident.css';

const HOME_LIMIT = 5;
const NEXT_STEPS = [
  { status: 'Submitted', key: 'home.nextSubmitted' },
  { status: 'Under Review', key: 'home.nextUnderReview' },
  { status: 'In Progress', key: 'home.nextInProgress' },
  { status: 'Resolved', key: 'home.nextResolved' },
];

export default function HomePage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data, loading, errorCode, reload } = useApiData('/resident/reports');

  const reports = data?.reports || [];
  const firstName = user.name.trim().split(/\s+/)[0];

  return (
    <ResidentLayout wide>
      <div className="home__banner hall-bg">
        <HallPhoto sizes="(min-width: 1100px) 1040px, 100vw" />
        <div className="home__greeting">
          <h1 className="page-title">{t('home.greeting', { name: firstName })}</h1>
          <p className="home__subtitle">{t('home.subtitle')}</p>
        </div>
        <Link to="/report" className="btn btn--outline home__cta">
          <Icon name="report" size={22} />
          <span>{t('actions.reportConcern')}</span>
        </Link>
      </div>

      <div className="home__columns">
        <section className="home__reports" aria-labelledby="home-reports-title">
          <div className="section-header">
            <h2 id="home-reports-title" className="section-title">{t('home.myReports')}</h2>
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
            <EmptyState
              title={t('empty.noReportsTitle')}
              message={t('empty.noReportsMessage')}
              action={
                <Link to="/report" className="btn btn--primary">
                  {t('actions.reportConcern')}
                </Link>
              }
            />
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

        {/* Explains the words residents see on their reports */}
        <aside className="home__next" aria-labelledby="home-next-title">
          <h2 id="home-next-title" className="section-title">{t('home.nextTitle')}</h2>
          <ol className="home__next-list">
            {NEXT_STEPS.map(({ status, key }) => (
              <li key={status}>
                <StatusBadge status={status} />
                <p>{t(key)}</p>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </ResidentLayout>
  );
}
