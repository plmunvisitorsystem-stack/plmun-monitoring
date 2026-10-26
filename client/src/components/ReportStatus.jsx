/**
 * A report's status badge, followed by the red "Overdue" tag when the report
 * is overdue. Used in every report list and on the details pages.
 *   status:    'Submitted' | 'Under Review' | 'In Progress' | 'Resolved'
 *   isOverdue: true / false (from the API)
 */
import StatusBadge from './StatusBadge';
import OverdueTag from './OverdueTag';
import './OverdueTag.css';

export default function ReportStatus({ status, isOverdue }) {
  return (
    <span className="report-status">
      <StatusBadge status={status} />
      {isOverdue && <OverdueTag />}
    </span>
  );
}
