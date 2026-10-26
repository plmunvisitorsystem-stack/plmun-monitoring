/**
 * LGU "Reports" (/admin/reports): every report, ready to assign to a
 * response team. High priority first, then the oldest first, 10 per page.
 * Filters: status, priority, area, issue type, "Unassigned only", and "Overdue only".
 * The filters are kept in the URL (?unassigned=1&page=2), so refreshing the
 * page or pressing Back keeps them.
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import StaffLayout from '../../layouts/StaffLayout';
import Card from '../../components/Card';
import Select from '../../components/Select';
import Button from '../../components/Button';
import Alert from '../../components/Alert';
import IssueTypeIcon from '../../components/IssueTypeIcon';
import ReportStatus from '../../components/ReportStatus';
import PriorityBadge from '../../components/PriorityBadge';
import EmptyState from '../../components/EmptyState';
import LoadError from '../../components/LoadError';
import Icon from '../../components/Icon';
import AssignReportDialog from './AssignReportDialog';
import { useLanguage } from '../../i18n/useLanguage';
import { useApiData } from '../../hooks/useApiData';
import { ISSUE_TYPES, ISSUE_TYPE_KEYS, PRIORITY_KEYS, STATUSES, STATUS_KEYS } from '../../utils/constants';
import { formatDate, formatReportId } from '../../utils/format';
import '../../components/Button.css';
import '../../components/ReportTable.css';
import '../team/TeamReports.css';
import './AdminReports.css';

// URL parameters this page understands.
const FILTER_KEYS = ['status', 'priority', 'area', 'issueType', 'unassigned', 'overdue'];

function readFilters(searchParams) {
  const filters = {};
  for (const key of FILTER_KEYS) filters[key] = searchParams.get(key) || '';
  return filters;
}

export default function AdminReportsPage() {
  const { t, language } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [draft, setDraft] = useState(() => readFilters(searchParams));
  const [assigningId, setAssigningId] = useState(null); // report shown in the dialog
  const [saved, setSaved] = useState(null); // success message after assigning

  // Keep the form in sync when the URL changes (e.g. Back button).
  useEffect(() => {
    setDraft(readFilters(searchParams));
  }, [searchParams]);

  const query = new URLSearchParams();
  for (const key of [...FILTER_KEYS, 'page']) {
    const value = searchParams.get(key);
    if (value) query.set(key, value);
  }
  const { data, loading, errorCode, reload } = useApiData(`/admin/reports?${query.toString()}`);
  const { data: areaData } = useApiData('/areas');

  function handleDraftChange(event) {
    const { name, value, type, checked } = event.target;
    setDraft((current) => ({ ...current, [name]: type === 'checkbox' ? (checked ? '1' : '') : value }));
  }

  function applyFilters(event) {
    event.preventDefault();
    const next = new URLSearchParams();
    for (const key of FILTER_KEYS) {
      if (draft[key]) next.set(key, draft[key]);
    }
    setSaved(null);
    setSearchParams(next); // back to page 1
  }

  function goToPage(page) {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(page));
    setSearchParams(next);
    window.scrollTo(0, 0);
  }

  // After "Confirm Assignment": show a message and load the list again
  // (the report may now move out of "Unassigned only").
  function handleAssigned(report, wasSubmitted) {
    setAssigningId(null);
    const id = formatReportId(report.id, report.dateSubmitted);
    setSaved(t(wasSubmitted ? 'assignDialog.savedNew' : 'assignDialog.savedMoved', { id, team: report.teamName }));
    reload();
  }

  const all = (label) => ({ value: '', label });
  const statusOptions = [all(t('teamReports.allStatuses')), ...STATUSES.map((s) => ({ value: s, label: t(`status.${STATUS_KEYS[s]}`) }))];
  const priorityOptions = [
    all(t('adminReports.allPriorities')),
    ...Object.keys(PRIORITY_KEYS).map((p) => ({ value: p, label: t(`priority.${PRIORITY_KEYS[p]}`) })),
  ];
  const areaOptions = [all(t('adminReports.allAreas')), ...(areaData?.areas || []).map((a) => ({ value: a, label: a }))];
  const issueTypeOptions = [
    all(t('teamReports.allIssueTypes')),
    ...ISSUE_TYPES.map((type) => ({ value: type, label: t(`issueType.${ISSUE_TYPE_KEYS[type]}`) })),
  ];

  const reports = data?.reports || [];
  const firstRow = data ? (data.page - 1) * data.pageSize + 1 : 0;
  const lastRow = data ? firstRow + reports.length - 1 : 0;

  return (
    <StaffLayout role="lgu">
      <div className="admin-reports__heading">
        <div>
          <h1 className="page-title">{t('nav.reports')}</h1>
          <p className="text-muted">{t('adminReports.intro')}</p>
        </div>
        {data && (
          <p className="unassigned-pill" role="status">
            <Icon name="inbox" size={20} />
            {t('adminReports.unassignedCount', { count: data.unassignedTotal })}
          </p>
        )}
      </div>

      {/* ----- Filters ----- */}
      <Card className="team-filters">
        <form className="admin-filters__form" onSubmit={applyFilters} role="search">
          <Select label={t('teamReports.status')} name="status" options={statusOptions} value={draft.status} onChange={handleDraftChange} />
          <Select label={t('priority.title')} name="priority" options={priorityOptions} value={draft.priority} onChange={handleDraftChange} />
          <Select label={t('fields.area')} name="area" options={areaOptions} value={draft.area} onChange={handleDraftChange} />
          <Select
            label={t('submitReport.issueType')}
            name="issueType"
            options={issueTypeOptions}
            value={draft.issueType}
            onChange={handleDraftChange}
          />
          <label className="check-field">
            <input type="checkbox" name="unassigned" checked={draft.unassigned === '1'} onChange={handleDraftChange} />
            <span>{t('adminReports.unassignedOnly')}</span>
          </label>
          <label className="check-field">
            <input type="checkbox" name="overdue" checked={draft.overdue === '1'} onChange={handleDraftChange} />
            <span>{t('overdue.only')}</span>
          </label>
          <Button type="submit" icon="list" className="team-filters__button">
            {t('teamReports.filter')}
          </Button>
        </form>
      </Card>

      {saved && (
        <Alert type="success" title={t('assign.savedTitle')}>
          {saved}
        </Alert>
      )}

      {/* ----- Results ----- */}
      {loading && <p className="text-muted" role="status">{t('common.loading')}</p>}
      {!loading && errorCode && <LoadError code={errorCode} onRetry={reload} />}
      {!loading && !errorCode && reports.length === 0 && (
        <EmptyState icon="list" title={t('teamReports.emptyTitle')} message={t('adminReports.emptyMessage')} />
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
                  <th scope="col">{t('fields.area')}</th>
                  <th scope="col">{t('priority.title')}</th>
                  <th scope="col" className="team-table__date">{t('reportDetails.dateSubmitted')}</th>
                  <th scope="col">{t('teamReports.status')}</th>
                  <th scope="col">{t('adminReports.assignedTeam')}</th>
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
                      {/* data-label is shown as a small heading when the table becomes cards */}
                      <td data-label={t('teamReports.reportId')} className="team-table__id">
                        <Link to={`/admin/reports/${report.id}`} state={{ from: `/admin/reports?${searchParams.toString()}` }}>
                          {displayId}
                        </Link>
                      </td>
                      <td data-label={t('submitReport.issueType')}>
                        <IssueTypeIcon type={report.issueType} />
                      </td>
                      <td data-label={t('fields.area')} className="admin-reports__nowrap">{report.area}</td>
                      <td data-label={t('priority.title')}>
                        <PriorityBadge priority={report.priority} />
                      </td>
                      <td data-label={t('reportDetails.dateSubmitted')} className="team-table__date">{formatDate(report.dateSubmitted, language)}</td>
                      <td data-label={t('teamReports.status')}>
                        <ReportStatus status={report.status} isOverdue={report.isOverdue} />
                      </td>
                      <td data-label={t('adminReports.assignedTeam')}>
                        {report.teamName || <span className="admin-reports__none">{t('generateReports.notAssigned')}</span>}
                      </td>
                      <td className="team-table__action">
                        {report.status === 'Resolved' ? (
                          <Link
                            to={`/admin/reports/${report.id}`}
                            state={{ from: `/admin/reports?${searchParams.toString()}` }}
                            className="btn btn--outline team-table__view"
                            aria-label={t('teamReports.viewReport', { id: displayId })}
                          >
                            <Icon name="eye" size={20} />
                            <span>{t('teamReports.view')}</span>
                          </Link>
                        ) : (
                          <Button
                            icon="users"
                            className="team-table__view"
                            aria-label={t('adminReports.assignReport', { id: displayId })}
                            onClick={() => {
                              setSaved(null);
                              setAssigningId(report.id);
                            }}
                          >
                            {t('adminReports.assign')}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

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

      <AssignReportDialog reportId={assigningId} onClose={() => setAssigningId(null)} onAssigned={handleAssigned} />
    </StaffLayout>
  );
}
