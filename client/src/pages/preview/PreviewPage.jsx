/**
 * TEMPORARY page at /preview that shows every reusable component,
 * so the design can be checked on a phone (390px) and desktop (1440px).
 * Delete this folder once the real pages are built.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Input from '../../components/Input';
import StatusBadge from '../../components/StatusBadge';
import IssueTypeIcon from '../../components/IssueTypeIcon';
import Alert from '../../components/Alert';
import EmptyState from '../../components/EmptyState';
import BottomNav from '../../components/BottomNav';
import Sidebar from '../../components/Sidebar';
import SampleReportCard, { SAMPLE_REPORTS } from './SampleReportCard';
import { useLanguage } from '../../i18n/useLanguage';
import { STATUSES, ISSUE_TYPES } from '../../utils/constants';
import './Preview.css';

export default function PreviewPage() {
  const { t } = useLanguage();
  const [location, setLocation] = useState('');

  return (
    <div className="preview-page">
      <Header />
      <main className="preview-main">
        <h1 className="page-title">{t('preview.title')}</h1>
        <p className="text-muted">{t('preview.intro')}</p>

        {/* Links to the full page layouts */}
        <section className="preview-layouts">
          <h2 className="section-title">{t('preview.layoutsTitle')}</h2>
          <div className="preview-row">
            <Link className="btn btn--outline" to="/preview/resident">{t('preview.residentLayout')}</Link>
            <Link className="btn btn--outline" to="/preview/team">{t('preview.teamLayout')}</Link>
            <Link className="btn btn--outline" to="/preview/lgu">{t('preview.lguLayout')}</Link>
          </div>
        </section>

        <div className="preview-grid">
          <Card title={t('preview.buttons')}>
            <div className="preview-stack">
              <Button fullWidth>{t('actions.logIn')}</Button>
              <Button variant="secondary" fullWidth>{t('actions.createAccount')}</Button>
              <Button icon="report" fullWidth>{t('actions.reportConcern')}</Button>
              <Button variant="outline" fullWidth>{t('actions.viewMyReport')}</Button>
              <Button fullWidth disabled>{t('actions.submitReport')}</Button>
            </div>
          </Card>

          <Card title={t('preview.inputs')}>
            <div className="preview-stack">
              <Input
                label={t('fields.location')}
                hint={t('fields.locationHint')}
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              />
              <Input label={t('fields.description')} multiline placeholder={t('fields.descriptionPlaceholder')} />
              <Input label={t('fields.location')} error={t('errors.FIELD_REQUIRED')} />
            </div>
          </Card>

          <Card title={t('preview.statusBadges')}>
            <div className="preview-row">
              {STATUSES.map((status) => (
                <StatusBadge key={status} status={status} />
              ))}
            </div>
          </Card>

          <Card title={t('preview.issueTypes')}>
            <div className="preview-stack">
              {ISSUE_TYPES.map((type) => (
                <IssueTypeIcon key={type} type={type} />
              ))}
            </div>
          </Card>

          <Card title={t('preview.alerts')}>
            <div className="preview-stack">
              <Alert type="success" title={t('messages.reportSubmitted')}>
                {t('messages.reportSubmittedDetail')}
              </Alert>
              <Alert type="error" title={t('messages.errorTitle')}>
                {t('messages.genericError')}
              </Alert>
            </div>
          </Card>

          <div className="preview-stack">
            <h2 className="section-title">{t('preview.card')}</h2>
            <SampleReportCard report={SAMPLE_REPORTS[0]} />
          </div>

          <Card title={t('preview.emptyState')}>
            <EmptyState
              title={t('empty.noReportsTitle')}
              message={t('empty.noReportsMessage')}
              action={<Button icon="report">{t('actions.reportConcern')}</Button>}
            />
          </Card>

          <Card title={t('preview.bottomNav')}>
            <div className="preview-frame">
              <BottomNav activeKey="home" />
            </div>
          </Card>

          <Card title={t('preview.sidebarTeam')}>
            <div className="preview-frame">
              <Sidebar role="response_team" activeKey="dashboard" onLogout={() => {}} />
            </div>
          </Card>

          <Card title={t('preview.sidebarLgu')}>
            <div className="preview-frame">
              <Sidebar role="lgu" activeKey="manageUsers" onLogout={() => {}} />
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
