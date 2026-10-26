/**
 * TEMPORARY pages that show the full layouts with sample content:
 *   /preview/resident  -> ResidentLayout (bottom navigation)
 *   /preview/team      -> StaffLayout for the response team
 *   /preview/lgu       -> StaffLayout for the LGU
 */
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import ResidentLayout from '../../layouts/ResidentLayout';
import StaffLayout from '../../layouts/StaffLayout';
import Button from '../../components/Button';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import SampleReportCard, { SAMPLE_REPORTS } from './SampleReportCard';
import { useLanguage } from '../../i18n/useLanguage';
import { STATUSES } from '../../utils/constants';
import './Preview.css';

// Sample numbers matching the seed data (6 / 12 / 12 / 18).
const SAMPLE_COUNTS = { Submitted: 6, 'Under Review': 12, 'In Progress': 12, Resolved: 18 };

export default function PreviewLayoutPage() {
  const { layout } = useParams();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const backLink = (
    <Link className="preview-back" to="/preview">
      {t('preview.backToPreview')}
    </Link>
  );

  if (layout === 'resident') {
    return (
      <ResidentLayout activeKey="home">
        {backLink}
        <h1 className="page-title">{t('home.greeting', { name: t('preview.sampleName') })}</h1>
        <Button icon="report" fullWidth>{t('actions.reportConcern')}</Button>
        <h2 className="section-title preview-spaced">{t('home.myReports')}</h2>
        <div className="preview-stack">
          {SAMPLE_REPORTS.map((report) => (
            <SampleReportCard key={report.displayId} report={report} />
          ))}
        </div>
      </ResidentLayout>
    );
  }

  if (layout === 'team' || layout === 'lgu') {
    return (
      <StaffLayout
        role={layout === 'team' ? 'response_team' : 'lgu'}
        activeKey="dashboard"
        onLogout={() => navigate('/preview')}
      >
        {backLink}
        <h1 className="page-title">{t('nav.dashboard')}</h1>
        <p className="text-muted">{t('dashboard.overview')}</p>
        <div className="preview-stats">
          {STATUSES.map((status) => (
            <Card key={status}>
              <StatusBadge status={status} />
              <p className="preview-stat-number">{SAMPLE_COUNTS[status]}</p>
            </Card>
          ))}
        </div>
      </StaffLayout>
    );
  }

  // Unknown layout name -> back to the preview page.
  return <Navigate to="/preview" replace />;
}
