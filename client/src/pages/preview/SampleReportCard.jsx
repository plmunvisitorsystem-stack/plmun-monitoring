/**
 * TEMPORARY (preview only): a report card built from the reusable components,
 * to check how they look together. Real report cards come in a later task.
 */
import Card from '../../components/Card';
import Icon from '../../components/Icon';
import IssueTypeIcon from '../../components/IssueTypeIcon';
import StatusBadge from '../../components/StatusBadge';
import { useLanguage } from '../../i18n/useLanguage';
import './Preview.css';

export const SAMPLE_REPORTS = [
  { displayId: '#2026-0102', type: 'Flooding', status: 'In Progress', locationKey: 'preview.sampleLocation' },
  { displayId: '#2026-0097', type: 'Waste Disposal', status: 'Resolved', locationKey: 'preview.sampleLocation2' },
];

export default function SampleReportCard({ report }) {
  const { t } = useLanguage();

  return (
    <Card className="sample-report">
      <div className="sample-report__top">
        <IssueTypeIcon type={report.type} />
        <StatusBadge status={report.status} />
      </div>
      <p className="sample-report__id">{report.displayId}</p>
      <p className="sample-report__meta">
        <Icon name="mapPin" size={18} />
        <span>{t(report.locationKey)}</span>
      </p>
      <p className="text-muted">{t('preview.sampleDate')}</p>
    </Card>
  );
}
