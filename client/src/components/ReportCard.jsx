/**
 * Report summary card that opens the Report Details page when tapped.
 *   report: { id, issueType, description, dateSubmitted, status, isOverdue }
 * Shows the issue icon, report ID, a short description (2 lines max),
 * the date, and the status badge (+ the red "Overdue" tag when overdue).
 */
import { Link, useLocation } from 'react-router-dom';
import IssueTypeIcon from './IssueTypeIcon';
import ReportStatus from './ReportStatus';
import { useLanguage } from '../i18n/useLanguage';
import { formatDate, formatReportId } from '../utils/format';
import './ReportCard.css';

export default function ReportCard({ report }) {
  const { language } = useLanguage();
  const location = useLocation();

  return (
    // "from" lets the details page's Back link return to this list.
    <Link to={`/reports/${report.id}`} state={{ from: location.pathname }} className="report-card">
      <div className="report-card__top">
        <IssueTypeIcon type={report.issueType} />
        <ReportStatus status={report.status} isOverdue={report.isOverdue} />
      </div>
      <p className="report-card__description">{report.description}</p>
      <p className="report-card__meta">
        <span>{formatReportId(report.id, report.dateSubmitted)}</span>
        <span aria-hidden="true">·</span>
        <span>{formatDate(report.dateSubmitted, language)}</span>
      </p>
    </Link>
  );
}
