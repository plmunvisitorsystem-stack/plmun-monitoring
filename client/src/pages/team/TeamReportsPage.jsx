/**
 * Response team "Reports List" (/team/reports).
 * Shows ONLY the reports the LGU assigned to this team (the server checks
 * this), with search, filters, and 10 rows per page.
 * The filters are kept in the URL (?status=...&page=2), so refreshing the
 * page or pressing Back keeps them.
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import StaffLayout from '../../layouts/StaffLayout';
import Card from '../../components/Card';
import Input from '../../components/Input';
import Select from '../../components/Select';
import Button from '../../components/Button';
import IssueTypeIcon from '../../components/IssueTypeIcon';
import ReportStatus from '../../components/ReportStatus';
import PriorityBadge from '../../components/PriorityBadge';
import EmptyState from '../../components/EmptyState';
import LoadError from '../../components/LoadError';
import Icon from '../../components/Icon';
import { useLanguage } from '../../i18n/useLanguage';
import { useApiData } from '../../hooks/useApiData';
import { ISSUE_TYPES, ISSUE_TYPE_KEYS, STATUSES, STATUS_KEYS } from '../../utils/constants';
import { formatDate, formatReportId } from '../../utils/format';
import '../../components/Button.css';
import '../../components/ReportTable.css';
import './TeamReports.css';

// URL parameters this page understands.
const FILTER_KEYS = ['search', 'issueType', 'status', 'dateFrom', 'dateTo', 'overdue'];

function readFilters(searchParams) {
  const filters = {};
  for (const key of FILTER_KEYS) filters[key] = searchParams.get(key) || '';
  return filters;
}

export default function TeamReportsPage() {
  const { t, language } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  // What is typed/selected in the form (applied only when "Filter" is pressed).
  const [draft, setDraft] = useState(() => readFilters(searchParams));

  // Keep the form in sync when the URL changes (e.g. Back button).
  useEffect(() => {
    setDraft(readFilters(searchParams));
  }, [searchParams]);

  // Build the API request from the URL: only filters that have a value.
  const query = new URLSearchParams();
  for (const key of [...FILTER_KEYS, 'page']) {
    const value = searchParams.get(key);
    if (value) query.set(key, value);
  }
  const { data, loading, errorCode, reload } = useApiData(`/team/reports?${query.toString()}`);

  function handleDraftChange(event) {
    const { name, value, type, checked } = event.target;
    // A checkbox is saved as '1' (ticked) or '' (not ticked).
    setDraft((current) => ({ ...current, [name]: type === 'checkbox' ? (checked ? '1' : '') : value }));
  }

  function applyFilters(event) {
    event.preventDefault();
    const next = new URLSearchParams();
    for (const key of FILTER_KEYS) {
      const value = draft[key].trim();
      if (value) next.set(key, value);
    }
    setSearchParams(next); // back to page 1
  }

  function goToPage(page) {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(page));
    setSearchParams(next);
    window.scrollTo(0, 0);
  }

  const issueTypeOptions = [
    { value: '', label: t('teamReports.allIssueTypes') },
    ...ISSUE_TYPES.map((type) => ({ value: type, label: t(`issueType.${ISSUE_TYPE_KEYS[type]}`) })),
  ];
  const statusOptions = [
    { value: '', label: t('teamReports.allStatuses') },
    ...STATUSES.map((status) => ({ value: status, label: t(`status.${STATUS_KEYS[status]}`) })),
  ];

  const reports = data?.reports || [];
  const firstRow = data ? (data.page - 1) * data.pageSize + 1 : 0;
  const lastRow = data ? firstRow + reports.length - 1 : 0;

  return (
    <StaffLayout role="response_team">
      <h1 className="page-title">{t('teamReports.title')}</h1>

      {/* ----- Search and filters ----- */}
      <Card className="team-filters">
        <form className="team-filters__form" onSubmit={applyFilters} role="search">
          <Input
            className="team-filters__search"
            label={t('teamReports.searchLabel')}
            name="search"
            type="search"
            maxLength={150}
            placeholder={t('teamReports.searchPlaceholder')}
            value={draft.search}
            onChange={handleDraftChange}
          />
          <Select
            label={t('submitReport.issueType')}
            name="issueType"
            options={issueTypeOptions}
            value={draft.issueType}
            onChange={handleDraftChange}
          />
          <Select
            label={t('teamReports.status')}
            name="status"
            options={statusOptions}
            value={draft.status}
            onChange={handleDraftChange}
          />
          <Input label={t('teamReports.dateFrom')} name="dateFrom" type="date" value={draft.dateFrom} onChange={handleDraftChange} />
          <Input label={t('teamReports.dateTo')} name="dateTo" type="date" value={draft.dateTo} onChange={handleDraftChange} />
          <label className="check-field">
            <input type="checkbox" name="overdue" checked={draft.overdue === '1'} onChange={handleDraftChange} />
            <span>{t('overdue.only')}</span>
          </label>
          <Button type="submit" icon="list" className="team-filters__button">
            {t('teamReports.filter')}
          </Button>
        </form>
      </Card>

      {/* ----- Results ----- */}
      {loading && <p className="text-muted" role="status">{t('common.loading')}</p>}
      {!loading && errorCode && <LoadError code={errorCode} onRetry={reload} />}
      {!loading && !errorCode && reports.length === 0 && (
        <EmptyState icon="list" title={t('teamReports.emptyTitle')} message={t('teamReports.emptyMessage')} />
      )}

      {!loading && !errorCode && reports.length > 0 && (
        <>
          <p className="team-reports__summary" role="status">
            {t('teamReports.showing', { from: firstRow, to: lastRow, total: data.total })}
          </p>

          <div className="team-table-wrap">
            <table className="team-table">
              <thead>
                <tr>
                  <th scope="col">{t('teamReports.reportId')}</th>
                  <th scope="col">{t('submitReport.issueType')}</th>
                  <th scope="col">{t('fields.location')}</th>
                  <th scope="col">{t('priority.title')}</th>
                  <th scope="col" className="team-table__date">{t('reportDetails.dateSubmitted')}</th>
                  <th scope="col">{t('teamReports.status')}</th>
                  <th scope="col">
                    <span className="visually-hidden">{t('teamReports.action')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => {
                  const displayId = formatReportId(report.id, report.dateSubmitted);
                  return (
                    <tr key={report.id}>
                      {/* data-label is shown as a small heading when the table becomes cards on phones */}
                      <td data-label={t('teamReports.reportId')} className="team-table__id">{displayId}</td>
                      <td data-label={t('submitReport.issueType')}>
                        <IssueTypeIcon type={report.issueType} />
                      </td>
                      <td data-label={t('fields.location')}>{report.location}</td>
                      <td data-label={t('priority.title')}>
                        <PriorityBadge priority={report.priority} />
                      </td>
                      <td data-label={t('reportDetails.dateSubmitted')} className="team-table__date">{formatDate(report.dateSubmitted, language)}</td>
                      <td data-label={t('teamReports.status')}>
                        <ReportStatus status={report.status} isOverdue={report.isOverdue} />
                      </td>
                      <td className="team-table__action">
                        <Link
                          to={`/team/reports/${report.id}`}
                          state={{ from: `/team/reports?${searchParams.toString()}` }}
                          className="btn btn--outline team-table__view"
                          aria-label={t('teamReports.viewReport', { id: displayId })}
                        >
                          <Icon name="eye" size={20} />
                          <span>{t('teamReports.view')}</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ----- Pages ----- */}
          <nav className="pagination" aria-label={t('teamReports.pages')}>
            <Button variant="outline" disabled={data.page <= 1} onClick={() => goToPage(data.page - 1)}>
              {t('teamReports.previous')}
            </Button>
            <span className="pagination__info">{t('teamReports.pageOf', { page: data.page, pages: data.totalPages })}</span>
            <Button variant="outline" disabled={data.page >= data.totalPages} onClick={() => goToPage(data.page + 1)}>
              {t('teamReports.next')}
            </Button>
          </nav>
        </>
      )}
    </StaffLayout>
  );
}
