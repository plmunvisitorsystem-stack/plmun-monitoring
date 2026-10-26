/**
 * Response team: report details + status update (/team/reports/:id).
 * Left:  report ID, issue type, location, description, date, resident's name.
 * Right: "Update Status" (In Progress / Resolved; only the next one can be chosen), "Resolution Notes"
 *        (required for Resolved), and "Save Update".
 * Only reports the LGU assigned to this team can be opened (others -> 403).
 * The team moves Under Review -> In Progress -> Resolved; every update notifies the resident.
 */
import { useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import StaffLayout from '../../layouts/StaffLayout';
import BackLink from '../../components/BackLink';
import Card from '../../components/Card';
import Select from '../../components/Select';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Alert from '../../components/Alert';
import IssueTypeIcon from '../../components/IssueTypeIcon';
import StatusBadge from '../../components/StatusBadge';
import ReportStatus from '../../components/ReportStatus';
import PriorityBadge from '../../components/PriorityBadge';
import PhotoGallery from '../../components/PhotoGallery';
import LinkedReports from '../../components/LinkedReports';
import EmptyState from '../../components/EmptyState';
import LoadError from '../../components/LoadError';
import { apiRequest } from '../../api/client';
import { useLanguage } from '../../i18n/useLanguage';
import { useApiData } from '../../hooks/useApiData';
import { STATUS_KEYS } from '../../utils/constants';
import { formatDateTime, formatReportId } from '../../utils/format';
import './TeamReportDetails.css';

const NOTES_MAX = 2000;
// The only statuses a response team can set (Submitted -> Under Review is done by the LGU).
const TEAM_STATUSES = ['In Progress', 'Resolved'];

export default function TeamReportDetailsPage() {
  const { t, language } = useLanguage();
  const { id } = useParams();
  const location = useLocation();
  const { data, loading, errorCode, reload } = useApiData(`/team/reports/${encodeURIComponent(id)}`);

  // The report shown on the page (replaced by the server's answer after saving).
  const [report, setReport] = useState(null);
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [saveError, setSaveError] = useState(null);
  const [savedStatus, setSavedStatus] = useState(null); // for the confirmation message
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false); // blocks a fast double-click

  useEffect(() => {
    if (data?.report) {
      setReport(data.report);
      setNotes(data.report.resolutionNotes || '');
    }
  }, [data]);

  // Back to the list with the same filters it had.
  const backTo = location.state?.from || '/team/reports';

  async function handleSave(event) {
    event.preventDefault();
    if (savingRef.current) return;
    setSaveError(null);
    setSavedStatus(null);

    // Same checks as the server, for instant feedback.
    const errors = {};
    if (!status) errors.status = 'STATUS_REQUIRED';
    if (status === 'Resolved' && !notes.trim()) errors.resolutionNotes = 'NOTES_REQUIRED';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    savingRef.current = true;
    setSaving(true);
    try {
      const result = await apiRequest(`/team/reports/${report.id}`, {
        method: 'PATCH',
        body: { status, resolutionNotes: notes },
      });
      setReport(result.report);
      setNotes(result.report.resolutionNotes || '');
      setStatus('');
      setSavedStatus(result.report.status);
    } catch (error) {
      setFieldErrors(error.fields || {});
      setSaveError(error.code);
      // The report may have changed (e.g. another team took it): reload it.
      if (error.code === 'INVALID_STATUS_CHANGE' || error.code === 'NOT_ASSIGNED_TO_TEAM') reload();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  // ----- Report cannot be opened -----
  if (!loading && (errorCode === 'NOT_ASSIGNED_TO_TEAM' || errorCode === 'NOT_FOUND')) {
    const notMine = errorCode === 'NOT_ASSIGNED_TO_TEAM';
    return (
      <StaffLayout role="response_team">
        <BackLink to={backTo} />
        <EmptyState
          icon="warning"
          title={t(notMine ? 'teamReport.notAssignedTitle' : 'reportDetails.notFoundTitle')}
          message={t(notMine ? 'teamReport.notAssignedMessage' : 'errors.NOT_FOUND')}
        />
      </StaffLayout>
    );
  }

  const statusLabel = (value) => t(`status.${STATUS_KEYS[value]}`);
  const notesRequired = status === 'Resolved';

  return (
    <StaffLayout role="response_team">
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

          {savedStatus && (
            <Alert type="success" title={t('teamReport.savedTitle')}>
              {t('teamReport.saved', { status: statusLabel(savedStatus) })}
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
              </dl>
              <LinkedReports reports={report.linkedReports} basePath="/team/reports" />
              <section className="team-report__photos">
                <h2 className="team-report__label">{t('photos.title')}</h2>
                <PhotoGallery photos={report.photos || []} />
              </section>
            </Card>

            {/* ----- Right: update ----- */}
            <Card className="team-report__update" title={t('teamReport.updateTitle')}>
              {report.nextStatus ? (
                <form className="team-report__form" onSubmit={handleSave} noValidate>
                  {saveError && saveError !== 'VALIDATION_FAILED' && saveError !== 'NOTES_REQUIRED' && (
                    <Alert type="error">{t(`errors.${saveError}`)}</Alert>
                  )}

                  <div className="team-report__current">
                    <span className="text-muted">{t('teamReport.currentStatus')}</span>
                    <StatusBadge status={report.status} />
                  </div>

                  <div>
                    <Select
                      label={t('teamReport.updateStatus')}
                      name="status"
                      value={status}
                      onChange={(event) => {
                        setStatus(event.target.value);
                        setFieldErrors({});
                        setSavedStatus(null);
                      }}
                      options={[
                        { value: '', label: t('teamReport.chooseStatus') },
                        // A team sets only In Progress or Resolved. Only the NEXT one can
                        // be chosen (statuses move forward one step); the other is disabled.
                        ...TEAM_STATUSES.map((value) => ({
                          value,
                          label: statusLabel(value),
                          disabled: value !== report.nextStatus,
                        })),
                      ]}
                    />
                    {fieldErrors.status && <p className="field__error">{t(`errors.${fieldErrors.status}`)}</p>}
                  </div>

                  <div>
                    <Input
                      label={t('reportDetails.resolutionNotes')}
                      hint={t(notesRequired ? 'teamReport.notesRequiredHint' : 'teamReport.notesHint')}
                      name="resolutionNotes"
                      multiline
                      rows={5}
                      maxLength={NOTES_MAX}
                      placeholder={t('teamReport.notesPlaceholder')}
                      value={notes}
                      onChange={(event) => {
                        setNotes(event.target.value);
                        setFieldErrors((current) => ({ ...current, resolutionNotes: undefined }));
                      }}
                      error={fieldErrors.resolutionNotes ? t(`errors.${fieldErrors.resolutionNotes}`) : undefined}
                    />
                    <p className="char-counter">
                      {t('submitReport.characterCount', { count: notes.length, max: NOTES_MAX })}
                    </p>
                  </div>

                  <Button type="submit" icon="check" fullWidth disabled={saving}>
                    {saving ? t('profile.saving') : t('teamReport.save')}
                  </Button>
                </form>
              ) : (
                <>
                  <Alert type="success">{t('teamReport.alreadyResolved')}</Alert>
                  {report.resolutionNotes && (
                    <div className="team-report__final-notes">
                      <p className="team-report__label">{t('reportDetails.resolutionNotes')}</p>
                      <p className="details__text">{report.resolutionNotes}</p>
                    </div>
                  )}
                </>
              )}
            </Card>
          </div>
        </>
      )}
    </StaffLayout>
  );
}
