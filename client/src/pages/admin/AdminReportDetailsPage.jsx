/**
 * LGU report details + "Assign to Response Team" (/admin/reports/:id).
 * - Submitted report: assigning sets the team AND the status to Under Review;
 *   the resident is notified.
 * - Under Review / In Progress: the report can be moved to another team.
 * - Resolved: no more changes.
 * The team whose assigned area includes the report's area is suggested.
 * Resolved reports can be featured on the public landing page slideshow.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import StaffLayout from '../../layouts/StaffLayout';
import BackLink from '../../components/BackLink';
import Card from '../../components/Card';
import Select from '../../components/Select';
import Button from '../../components/Button';
import Alert from '../../components/Alert';
import IssueTypeIcon from '../../components/IssueTypeIcon';
import ReportStatus from '../../components/ReportStatus';
import PriorityBadge from '../../components/PriorityBadge';
import PhotoGallery from '../../components/PhotoGallery';
import LinkedReports from '../../components/LinkedReports';
import StatusTimeline from '../../components/StatusTimeline';
import EmptyState from '../../components/EmptyState';
import LoadError from '../../components/LoadError';
import FeatureCaseDialog from './FeatureCaseDialog';
import { apiRequest } from '../../api/client';
import { useLanguage } from '../../i18n/useLanguage';
import { useApiData } from '../../hooks/useApiData';
import { formatDateTime, formatReportId } from '../../utils/format';
import '../team/TeamReportDetails.css';
import './FeaturedCases.css';

export default function AdminReportDetailsPage() {
  const { t, language } = useLanguage();
  const { id } = useParams();
  const location = useLocation();
  const { data, loading, errorCode, reload } = useApiData(`/admin/reports/${encodeURIComponent(id)}`);

  const [report, setReport] = useState(null);
  const [teamId, setTeamId] = useState('');
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(null); // { teamName, nowUnderReview }
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [featureOpen, setFeatureOpen] = useState(false);
  const [featureSaved, setFeatureSaved] = useState(false);

  const teams = data?.teams || [];

  useEffect(() => {
    if (!data?.report) return;
    setReport(data.report);
    // Pre-select the current team, or the team that covers this area.
    const suggested = data.teams.find((team) => team.coversArea);
    setTeamId(String(data.report.teamId || suggested?.id || ''));
  }, [data]);

  const backTo = location.state?.from || '/admin/reports';

  async function handleAssign(event) {
    event.preventDefault();
    if (savingRef.current) return;
    setError(null);
    setSaved(null);
    if (!teamId) {
      setError('TEAM_NOT_FOUND');
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      const wasSubmitted = report.status === 'Submitted';
      const result = await apiRequest(`/admin/reports/${report.id}/assign`, { method: 'PATCH', body: { team_id: Number(teamId) } });
      setReport(result.report);
      setSaved({ teamName: result.report.teamName, nowUnderReview: wasSubmitted });
    } catch (err) {
      setError(err.code);
      if (err.code === 'REPORT_ALREADY_RESOLVED') reload();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  if (!loading && errorCode === 'NOT_FOUND') {
    return (
      <StaffLayout role="lgu">
        <BackLink to={backTo} />
        <EmptyState icon="warning" title={t('reportDetails.notFoundTitle')} message={t('errors.NOT_FOUND')} />
      </StaffLayout>
    );
  }

  // Short option text (long text gets cut off in a dropdown); the areas of the
  // chosen team are shown under the dropdown instead.
  const teamLabel = (team) => `${team.teamName}${team.coversArea ? ` (${t('assign.suggested')})` : ''}`;
  const chosenTeam = teams.find((team) => String(team.id) === teamId);
  const unchanged = report && String(report.teamId || '') === teamId;

  return (
    <StaffLayout role="lgu">
      <BackLink to={backTo} />

      {loading && <p className="text-muted" role="status">{t('common.loading')}</p>}
      {!loading && errorCode && <LoadError code={errorCode} onRetry={reload} />}

      {!loading && report && (
        <>
          <div className="team-report__heading">
            <div>
              <p className="text-muted">{t('reportDetails.title')}</p>
              <h1 className="page-title">{formatReportId(report.id, report.dateSubmitted)}</h1>
            </div>
            <ReportStatus status={report.status} isOverdue={report.isOverdue} />
          </div>

          {saved && (
            <Alert type="success" title={t('assign.savedTitle')}>
              {t(saved.nowUnderReview ? 'assign.savedNew' : 'assign.savedMoved', { team: saved.teamName })}
            </Alert>
          )}

          <div className="team-report">
            {/* ----- Left: the report ----- */}
            <Card className="team-report__info">
              <div className="team-report__tags">
                <IssueTypeIcon type={report.issueType} />
                <PriorityBadge priority={report.priority} />
              </div>
              <dl className="details__list team-report__list">
                <div>
                  <dt>{t('fields.area')}</dt>
                  <dd>{report.area}</dd>
                </div>
                <div>
                  <dt>{t('fields.streetLandmark')}</dt>
                  <dd>{report.location}</dd>
                </div>
                <div>
                  <dt>{t('fields.description')}</dt>
                  <dd className="details__text">{report.description}</dd>
                </div>
                <div>
                  <dt>{t('reportDetails.dateSubmitted')}</dt>
                  <dd>{formatDateTime(report.dateSubmitted, language)}</dd>
                </div>
                <div>
                  <dt>{t('teamReport.submittedBy')}</dt>
                  <dd>{report.residentName}</dd>
                </div>
                <div>
                  <dt>{t('generateReports.team')}</dt>
                  <dd>{report.teamName || t('generateReports.notAssigned')}</dd>
                </div>
                {report.resolutionNotes && (
                  <div>
                    <dt>{t('reportDetails.resolutionNotes')}</dt>
                    <dd className="details__text">{report.resolutionNotes}</dd>
                  </div>
                )}
              </dl>
              <LinkedReports reports={report.linkedReports} basePath="/admin/reports" />
              <section className="team-report__photos">
                <h2 className="team-report__label">{t('photos.title')}</h2>
                <PhotoGallery photos={report.photos || []} />
              </section>
            </Card>

            {/* ----- Right: assign + status ----- */}
            <div className="team-report__side">
              <Card title={t('assign.title')}>
                {report.status === 'Resolved' ? (
                  <Alert type="success">{t('assign.resolved')}</Alert>
                ) : (
                  <form className="team-report__form" onSubmit={handleAssign} noValidate>
                    {error && <Alert type="error">{t(`errors.${error}`)}</Alert>}
                    <p className="team-report__note">
                      {t(report.status === 'Submitted' ? 'assign.hintNew' : 'assign.hintMove')}
                    </p>
                    <Select
                      label={t('assign.team')}
                      name="teamId"
                      value={teamId}
                      onChange={(event) => {
                        setTeamId(event.target.value);
                        setSaved(null);
                        setError(null);
                      }}
                      options={[
                        { value: '', label: t('assign.chooseTeam') },
                        ...teams.map((team) => ({ value: String(team.id), label: teamLabel(team) })),
                      ]}
                    />
                    {chosenTeam && (
                      <p className="text-muted assign__covers">{t('assign.covers', { areas: chosenTeam.assignedArea })}</p>
                    )}
                    <Button type="submit" icon="users" fullWidth disabled={saving || unchanged}>
                      {saving ? t('profile.saving') : t('assign.button')}
                    </Button>
                  </form>
                )}
              </Card>

              {report.status === 'Resolved' && (
                <Card title={t('featured.cardTitle')}>
                  {featureSaved && (
                    <Alert type="success" title={t('featured.publishedTitle')}>
                      {t('featured.publishedMessage')}
                    </Alert>
                  )}
                  {report.featured ? (
                    <>
                      <p className="featured-card__caption">“{report.featured.caption}”</p>
                      <p className="text-muted">
                        {t(report.featured.isVisible ? 'featured.cardVisible' : 'featured.cardHidden')}
                      </p>
                      <div className="modal__actions">
                        <Button variant="outline" icon="pencil" onClick={() => setFeatureOpen(true)}>
                          {t('featured.edit')}
                        </Button>
                        <Link className="btn btn--outline" to="/admin/featured-cases">
                          <span>{t('featured.manage')}</span>
                        </Link>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="team-report__note">{t('featured.cardHint')}</p>
                      <Button icon="star" fullWidth onClick={() => setFeatureOpen(true)}>
                        {t('featured.featureButton')}
                      </Button>
                    </>
                  )}
                </Card>
              )}

              <Card title={t('reportDetails.statusTitle')}>
                <StatusTimeline status={report.status} />
              </Card>
            </div>
          </div>
          <FeatureCaseDialog
            open={featureOpen}
            onClose={() => setFeatureOpen(false)}
            reportId={report.id}
            featured={report.featured}
            slide={{ issueType: report.issueType, area: report.area, dateResolved: report.dateResolved }}
            onSaved={(featured) => {
              setReport((current) => ({ ...current, featured }));
              setFeatureOpen(false);
              setFeatureSaved(true);
            }}
          />
        </>
      )}
    </StaffLayout>
  );
}
