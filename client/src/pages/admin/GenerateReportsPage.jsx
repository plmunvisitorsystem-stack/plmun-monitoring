/**
 * LGU "Generate Reports" (/admin/generate-reports).
 * Filters (date range, issue type, status) -> "Generate Report" ->
 * summary, "Reports by Category" bar chart, "Monthly Trend" line chart,
 * and the list of matching reports.
 * "Print Report" prints only the report (with a Barangay Landayan header);
 * "Export CSV" downloads the same rows for Excel.
 * Filters are kept in the URL, so a generated report can be refreshed or bookmarked.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import StaffLayout from '../../layouts/StaffLayout';
import Card from '../../components/Card';
import Input from '../../components/Input';
import Select from '../../components/Select';
import Button from '../../components/Button';
import Alert from '../../components/Alert';
import Logo from '../../components/Logo';
import EmptyState from '../../components/EmptyState';
import LoadError from '../../components/LoadError';
import IssueTypeIcon from '../../components/IssueTypeIcon';
import ReportStatus from '../../components/ReportStatus';
import SummaryCards from '../../components/dashboard/SummaryCards';
import IssueTypeChart from '../../components/dashboard/IssueTypeChart';
import MonthlyTrendChart from '../../components/dashboard/MonthlyTrendChart';
import HotspotCard from '../../components/dashboard/HotspotCard';
import '../../components/dashboard/chartSetup';
import { useLanguage } from '../../i18n/useLanguage';
import { useApiData } from '../../hooks/useApiData';
import { downloadFile } from '../../utils/download';
import { ISSUE_TYPES, ISSUE_TYPE_KEYS, STATUSES, STATUS_KEYS } from '../../utils/constants';
import { formatDate, formatDateTime, formatReportId } from '../../utils/format';
import '../../components/dashboard/Dashboard.css';
import '../../components/ReportTable.css';
import '../team/TeamReports.css';
import './GenerateReports.css';

const FILTER_KEYS = ['dateFrom', 'dateTo', 'issueType', 'status', 'overdue'];

function readFilters(searchParams) {
  const filters = {};
  for (const key of FILTER_KEYS) filters[key] = searchParams.get(key) || '';
  return filters;
}

// Today as "YYYY-MM-DD 00:00:00" so formatDateTime can show when the report was made.
function nowAsDbText() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

export default function GenerateReportsPage() {
  const { t, language } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [draft, setDraft] = useState(() => readFilters(searchParams));
  const [exportError, setExportError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const exportingRef = useRef(false);

  useEffect(() => {
    setDraft(readFilters(searchParams));
  }, [searchParams]);

  const query = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = searchParams.get(key);
    if (value) query.set(key, value);
  }
  // "generated" changes on every click so pressing the button always reloads.
  const generated = searchParams.get('generated') || '';
  const { data, loading, errorCode, reload } = useApiData(`/admin/reports/export?${query.toString()}&g=${generated}`);

  function handleGenerate(event) {
    event.preventDefault();
    const next = new URLSearchParams();
    for (const key of FILTER_KEYS) if (draft[key]) next.set(key, draft[key]);
    next.set('generated', String(Date.now()));
    setSearchParams(next);
    setExportError(null);
  }

  async function handleExport() {
    if (exportingRef.current) return;
    exportingRef.current = true;
    setExporting(true);
    setExportError(null);
    try {
      const csvQuery = new URLSearchParams(query);
      csvQuery.set('format', 'csv');
      await downloadFile(`/admin/reports/export?${csvQuery.toString()}`, 'landayan-reports.csv');
    } catch (error) {
      setExportError(error.message);
    } finally {
      exportingRef.current = false;
      setExporting(false);
    }
  }

  const issueLabel = (type) => t(`issueType.${ISSUE_TYPE_KEYS[type]}`);
  const statusLabel = (status) => t(`status.${STATUS_KEYS[status]}`);

  // Text describing the filters used, for the printed header.
  const applied = data?.filters;
  let dateRangeText = '';
  if (applied) {
    const from = applied.dateFrom ? formatDate(applied.dateFrom, language) : null;
    const to = applied.dateTo ? formatDate(applied.dateTo, language) : null;
    if (from && to) dateRangeText = t('generateReports.rangeBoth', { from, to });
    else if (from) dateRangeText = t('generateReports.rangeFrom', { from });
    else if (to) dateRangeText = t('generateReports.rangeTo', { to });
    else dateRangeText = t('generateReports.allDates');
  }

  return (
    <StaffLayout role="lgu">
      <div className="generate">
        <div className="no-print">
          <h1 className="page-title">{t('nav.generateReports')}</h1>
          <p className="text-muted">{t('generateReports.intro')}</p>
        </div>

        {/* ----- Filters (not printed) ----- */}
        <Card className="no-print">
          <form className="generate__filters" onSubmit={handleGenerate}>
            <Input
              label={t('generateReports.dateFrom')}
              name="dateFrom"
              type="date"
              value={draft.dateFrom}
              onChange={(e) => setDraft((d) => ({ ...d, dateFrom: e.target.value }))}
            />
            <Input
              label={t('generateReports.dateTo')}
              name="dateTo"
              type="date"
              value={draft.dateTo}
              onChange={(e) => setDraft((d) => ({ ...d, dateTo: e.target.value }))}
            />
            <Select
              label={t('submitReport.issueType')}
              name="issueType"
              value={draft.issueType}
              onChange={(e) => setDraft((d) => ({ ...d, issueType: e.target.value }))}
              options={[{ value: '', label: t('teamReports.allIssueTypes') }, ...ISSUE_TYPES.map((v) => ({ value: v, label: issueLabel(v) }))]}
            />
            <Select
              label={t('teamReports.status')}
              name="status"
              value={draft.status}
              onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
              options={[{ value: '', label: t('teamReports.allStatuses') }, ...STATUSES.map((v) => ({ value: v, label: statusLabel(v) }))]}
            />
            <label className="check-field">
            <input type="checkbox" name="overdue" checked={draft.overdue === '1'} onChange={(e) => setDraft((d) => ({ ...d, overdue: e.target.checked ? '1' : '' }))} />
            <span>{t('overdue.only')}</span>
          </label>
            <Button type="submit" icon="chart" className="generate__button">
              {t('generateReports.generate')}
            </Button>
          </form>
        </Card>

        {loading && <p className="text-muted no-print" role="status">{t('common.loading')}</p>}
        {!loading && errorCode && <LoadError code={errorCode} onRetry={reload} />}

        {!loading && data && (
          <>
            {/* ----- Actions (not printed) ----- */}
            <div className="generate__actions no-print">
              <Button variant="outline" icon="file" onClick={() => window.print()}>
                {t('generateReports.print')}
              </Button>
              <Button variant="secondary" icon="list" onClick={handleExport} disabled={exporting}>
                {exporting ? t('generateReports.exporting') : t('generateReports.exportCsv')}
              </Button>
            </div>
            {exportError && (
              <div className="no-print">
                <Alert type="error">{t(`errors.${exportError}`)}</Alert>
              </div>
            )}

            {/* ----- The report (this is what gets printed) ----- */}
            <article className="report-document">
              {/* Letterhead: only on paper */}
              <header className="print-only report-letterhead">
                <Logo size={60} loading="eager" />
                <div>
                  <p className="report-letterhead__barangay">{t('app.subtitle')}</p>
                  <p className="report-letterhead__system">{t('app.title')}</p>
                </div>
              </header>

              <div className="report-document__title">
                <h2 className="section-title">{t('generateReports.reportTitle')}</h2>
                <dl className="report-document__filters">
                  <div>
                    <dt>{t('generateReports.dateRange')}</dt>
                    <dd>{dateRangeText}</dd>
                  </div>
                  <div>
                    <dt>{t('submitReport.issueType')}</dt>
                    <dd>{applied.issueType ? issueLabel(applied.issueType) : t('teamReports.allIssueTypes')}</dd>
                  </div>
                  <div>
                    <dt>{t('teamReports.status')}</dt>
                    <dd>{applied.status ? statusLabel(applied.status) : t('teamReports.allStatuses')}</dd>
                  </div>
                  {applied.overdue && (
                    <div>
                      <dt>{t('overdue.filterTitle')}</dt>
                      <dd>{t('overdue.only')}</dd>
                    </div>
                  )}
                  <div className="print-only">
                    <dt>{t('generateReports.generatedOn')}</dt>
                    <dd>{formatDateTime(nowAsDbText(), language)}</dd>
                  </div>
                </dl>
              </div>

              <SummaryCards total={data.summary.total} byStatus={data.summary.byStatus} />

              {/* Always the last 30 days (not the date filters); printed with the report */}
              <HotspotCard data={data.hotspots} />

              {data.summary.total === 0 ? (
                <EmptyState icon="list" title={t('teamReports.emptyTitle')} message={t('teamReports.emptyMessage')} />
              ) : (
                <>
                  <div className="dashboard__charts report-document__charts">
                    <Card title={t('generateReports.byCategory')}>
                      <IssueTypeChart byIssueType={data.summary.byIssueType} title={t('generateReports.byCategory')} />
                    </Card>
                    <Card title={t('generateReports.monthlyTrend')}>
                      <MonthlyTrendChart byMonth={data.summary.byMonth} title={t('generateReports.monthlyTrend')} />
                    </Card>
                  </div>

                  <section className="report-document__list">
                    <h3 className="section-title">{t('generateReports.listTitle', { count: data.rows.length })}</h3>
                    <div className="team-table-wrap">
                      <table className="team-table report-list-table">
                        <thead>
                          <tr>
                            <th scope="col">{t('teamReports.reportId')}</th>
                            <th scope="col" className="team-table__date">{t('reportDetails.dateSubmitted')}</th>
                            <th scope="col">{t('submitReport.issueType')}</th>
                            <th scope="col">{t('fields.area')}</th>
                            <th scope="col">{t('fields.location')}</th>
                            <th scope="col">{t('teamReports.status')}</th>
                            <th scope="col">{t('generateReports.team')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.rows.map((row) => (
                            <tr key={row.id}>
                              <td data-label={t('teamReports.reportId')} className="team-table__id">
                                {/* Opens the report so the LGU can assign it to a team */}
                                <Link to={`/admin/reports/${row.id}`} state={{ from: `/admin/generate-reports?${searchParams.toString()}` }}>
                                  {formatReportId(row.id, row.dateSubmitted)}
                                </Link>
                              </td>
                              <td data-label={t('reportDetails.dateSubmitted')} className="team-table__date">{formatDate(row.dateSubmitted, language)}</td>
                              <td data-label={t('submitReport.issueType')}>
                                <IssueTypeIcon type={row.issueType} />
                              </td>
                              <td data-label={t('fields.area')}>{row.area}</td>
                              <td data-label={t('fields.location')}>{row.location}</td>
                              <td data-label={t('teamReports.status')}>
                                <ReportStatus status={row.status} isOverdue={row.isOverdue} />
                              </td>
                              <td data-label={t('generateReports.team')}>{row.teamName || t('generateReports.notAssigned')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              )}
            </article>
          </>
        )}
      </div>
    </StaffLayout>
  );
}
