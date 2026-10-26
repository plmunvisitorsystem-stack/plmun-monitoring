/**
 * Dashboard content shared by the response team and the LGU.
 * The server decides the scope from the login token:
 *   response team -> only the reports assigned to it
 *   LGU           -> all reports
 *   role: 'response_team' or 'lgu' (decides the links)
 */
import './chartSetup';
import SummaryCards from './SummaryCards';
import IssueTypeChart from './IssueTypeChart';
import StatusDonutChart from './StatusDonutChart';
import RecentReportsTable from './RecentReportsTable';
import HotspotCard from './HotspotCard';
import Card from '../Card';
import Icon from '../Icon';
import LoadError from '../LoadError';
import { useAuth } from '../../auth/useAuth';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../i18n/useLanguage';
import { useApiData } from '../../hooks/useApiData';
import '../Button.css';
import './Dashboard.css';

const LINKS = {
  response_team: { viewAll: '/team/reports', details: (id) => `/team/reports/${id}`, overdue: '/team/reports?overdue=1' },
  lgu: { viewAll: '/admin/reports', details: (id) => `/admin/reports/${id}`, overdue: '/admin/reports?overdue=1' },
};

export default function DashboardView({ role }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data, loading, errorCode, reload } = useApiData('/dashboard/summary');
  // Overdue reports (team: only its own; LGU: all) - the server decides.
  const { data: overdue } = useApiData('/alerts/overdue');
  // Hotspots (team: only inside its assigned area; LGU: all areas) - the server decides.
  const { data: hotspots } = useApiData('/hotspots');
  const links = LINKS[role];

  return (
    <div className="dashboard">
      <div>
        <h1 className="page-title">{t('nav.dashboard')}</h1>
        <p className="text-muted">
          {t('home.greeting', { name: user.name })} {t(role === 'lgu' ? 'dashboard.scopeAll' : 'dashboard.scopeTeam')}
        </p>
      </div>

      {/* Overdue alert: only when there is at least one overdue report */}
      {overdue?.total > 0 && (
        <section className="overdue-alert" role="alert">
          <span className="overdue-alert__icon">
            <Icon name="clock" />
          </span>
          <div className="overdue-alert__text">
            <p className="overdue-alert__title">
              {t(overdue.total === 1 ? 'overdue.alertOne' : 'overdue.alertMany', { count: overdue.total })}
            </p>
            <p className="overdue-alert__hint">{t('overdue.alertHint', { days: overdue.overdueDays })}</p>
          </div>
          <Link to={links.overdue} className="btn btn--outline overdue-alert__view">
            <Icon name="eye" />
            <span>{t('overdue.view')}</span>
          </Link>
        </section>
      )}

      {loading && <p className="text-muted" role="status">{t('common.loading')}</p>}
      {!loading && errorCode && <LoadError code={errorCode} onRetry={reload} />}

      {!loading && data && (
        <>
          {/* LGU only: how many reports still need a response team */}
          {role === 'lgu' && data.unassigned !== null && (
            <section className="unassigned-card" aria-labelledby="unassigned-title">
              <span className="unassigned-card__icon">
                <Icon name="inbox" />
              </span>
              <div className="unassigned-card__text">
                <h2 id="unassigned-title" className="unassigned-card__title">
                  {t('dashboard.unassignedTitle')}: <span className="unassigned-card__count">{data.unassigned}</span>
                </h2>
                <p className="text-muted">{t(data.unassigned > 0 ? 'dashboard.unassignedMessage' : 'dashboard.unassignedNone')}</p>
              </div>
              {data.unassigned > 0 && (
                <Link to="/admin/reports?unassigned=1" className="btn btn--primary unassigned-card__action">
                  <Icon name="users" />
                  <span>{t('dashboard.unassignedAction')}</span>
                </Link>
              )}
            </section>
          )}

          <SummaryCards total={data.total} byStatus={data.byStatus} />

          <div className="dashboard__charts">
            <Card title={t('dashboard.byIssueType')}>
              <IssueTypeChart byIssueType={data.byIssueType} />
            </Card>
            <Card title={t('dashboard.byStatus')}>
              <StatusDonutChart total={data.total} byStatus={data.byStatus} />
            </Card>
          </div>

          <HotspotCard data={hotspots} />

          <RecentReportsTable reports={data.recentReports} viewAllPath={links.viewAll} detailsPath={links.details} />
        </>
      )}
    </div>
  );
}
