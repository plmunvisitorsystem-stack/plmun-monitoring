/**
 * All of the resident's reports, newest first (/reports).
 * Opened from "View All" on the Home page. "Overdue only" shows only the
 * reports that are not Resolved and older than OVERDUE_DAYS days.
 */
import { useState } from 'react';
import ResidentLayout from '../../layouts/ResidentLayout';
import BackLink from '../../components/BackLink';
import ReportCard from '../../components/ReportCard';
import EmptyState from '../../components/EmptyState';
import LoadError from '../../components/LoadError';
import { useLanguage } from '../../i18n/useLanguage';
import { useApiData } from '../../hooks/useApiData';
import '../../components/Input.css';
import './Resident.css';

export default function MyReportsPage() {
  const { t } = useLanguage();
  const { data, loading, errorCode, reload } = useApiData('/resident/reports');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const allReports = data?.reports || [];
  const reports = overdueOnly ? allReports.filter((report) => report.isOverdue) : allReports;

  return (
    <ResidentLayout activeKey="home">
      <BackLink to="/home" />
      <h1 className="page-title">{t('home.myReports')}</h1>
      {allReports.length > 0 && (
        <label className="check-field">
          <input type="checkbox" checked={overdueOnly} onChange={(event) => setOverdueOnly(event.target.checked)} />
          <span>{t('overdue.only')}</span>
        </label>
      )}

      {loading && <p className="text-muted" role="status">{t('common.loading')}</p>}
      {!loading && errorCode && <LoadError code={errorCode} onRetry={reload} />}
      {!loading && !errorCode && allReports.length === 0 && (
        <EmptyState title={t('empty.noReportsTitle')} message={t('empty.noReportsMessage')} />
      )}
      {!loading && !errorCode && allReports.length > 0 && reports.length === 0 && (
        <EmptyState icon="checkCircle" title={t('overdue.noneTitle')} message={t('overdue.noneMessage')} />
      )}
      {!loading && !errorCode && reports.length > 0 && (
        <ul className="report-list">
          {reports.map((report) => (
            <li key={report.id}>
              <ReportCard report={report} />
            </li>
          ))}
        </ul>
      )}
    </ResidentLayout>
  );
}
