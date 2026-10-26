/**
 * LGU "Performance" (/admin/performance):
 * summary cards, the overall resolution rate (Resolved / Total),
 * and a table per response team (assigned, In Progress, Resolved, rate).
 */
import StaffLayout from '../../layouts/StaffLayout';
import Card from '../../components/Card';
import LoadError from '../../components/LoadError';
import SummaryCards from '../../components/dashboard/SummaryCards';
import { useLanguage } from '../../i18n/useLanguage';
import { useApiData } from '../../hooks/useApiData';
import { formatPercent } from '../../utils/format';
import '../../components/dashboard/Dashboard.css';
import '../../components/ReportTable.css';
import './Performance.css';

export default function PerformancePage() {
  const { t, language } = useLanguage();
  const { data, loading, errorCode, reload } = useApiData('/admin/performance');

  return (
    <StaffLayout role="lgu">
      <div className="performance">
        <div>
          <h1 className="page-title">{t('nav.performance')}</h1>
          <p className="text-muted">{t('performance.intro')}</p>
        </div>

        {loading && <p className="text-muted" role="status">{t('common.loading')}</p>}
        {!loading && errorCode && <LoadError code={errorCode} onRetry={reload} />}

        {!loading && data && (
          <>
            <SummaryCards total={data.total} byStatus={data.byStatus} />

            {/* Overall resolution rate */}
            <Card className="rate-card" title={t('performance.resolutionRate')}>
              <p className="rate-card__value">{formatPercent(data.resolutionRate, language)}</p>
              <div className="rate-card__bar" aria-hidden="true">
                <span style={{ width: `${Math.round(data.resolutionRate * 100)}%` }} />
              </div>
              <p className="text-muted">
                {t('performance.rateExplained', { resolved: data.byStatus.Resolved, total: data.total })}
              </p>
            </Card>

            {/* Per response team */}
            <section>
              <h2 className="section-title">{t('performance.teamsTitle')}</h2>
              <div className="team-table-wrap">
                <table className="team-table performance-table">
                  <thead>
                    <tr>
                      <th scope="col">{t('profile.roles.response_team')}</th>
                      <th scope="col" className="num">{t('performance.assigned')}</th>
                      <th scope="col" className="num">{t('status.inProgress')}</th>
                      <th scope="col" className="num">{t('status.resolved')}</th>
                      <th scope="col" className="num">{t('performance.resolutionRate')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.teams.map((team) => (
                      <tr key={team.id}>
                        <td data-label={t('profile.roles.response_team')}>
                          <span className="user-cell__name">{team.teamName}</span>
                          <span className="user-cell__username">{team.assignedArea}</span>
                        </td>
                        <td data-label={t('performance.assigned')} className="num">{team.assigned}</td>
                        <td data-label={t('status.inProgress')} className="num">{team.inProgress}</td>
                        <td data-label={t('status.resolved')} className="num">{team.resolved}</td>
                        <td data-label={t('performance.resolutionRate')} className="num">
                          {team.assigned > 0 ? formatPercent(team.resolutionRate, language) : t('common.none')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-muted performance__unassigned">
                {t('performance.unassigned', { count: data.unassigned })}
              </p>
            </section>
          </>
        )}
      </div>
    </StaffLayout>
  );
}
