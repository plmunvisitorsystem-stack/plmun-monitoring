/**
 * "Assign Report" dialog on the LGU Reports page.
 *   reportId:   the report to assign (null = dialog closed)
 *   onClose:    called when the dialog should close
 *   onAssigned: called with the updated report after a successful assignment
 *
 * Shows the report details, the Suggested Team (the team whose assigned area
 * includes the report's area), a dropdown of all teams, and "Confirm Assignment".
 * The data comes from GET /api/admin/reports/:id (report + teams with coversArea).
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../../components/Modal';
import Select from '../../components/Select';
import Button from '../../components/Button';
import Alert from '../../components/Alert';
import IssueTypeIcon from '../../components/IssueTypeIcon';
import ReportStatus from '../../components/ReportStatus';
import PriorityBadge from '../../components/PriorityBadge';
import LoadError from '../../components/LoadError';
import { apiRequest } from '../../api/client';
import { useLanguage } from '../../i18n/useLanguage';
import { formatDateTime, formatReportId } from '../../utils/format';

export default function AssignReportDialog({ reportId, onClose, onAssigned }) {
  const { t, language } = useLanguage();
  const [data, setData] = useState(null); // { report, teams }
  const [loadError, setLoadError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [teamId, setTeamId] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false); // blocks a double click before React re-renders

  // Load the report and the teams each time the dialog opens.
  useEffect(() => {
    if (!reportId) return undefined;
    let active = true;
    setData(null);
    setLoadError(null);
    setError(null);
    apiRequest(`/admin/reports/${reportId}`)
      .then((result) => {
        if (!active) return;
        setData(result);
        // Pre-select the current team, or else the suggested team.
        const suggested = result.teams.find((team) => team.coversArea);
        setTeamId(String(result.report.teamId || suggested?.id || ''));
      })
      .catch((err) => {
        if (active) setLoadError(err.code);
      });
    return () => {
      active = false;
    };
  }, [reportId, attempt]);

  async function handleConfirm(event) {
    event.preventDefault();
    if (savingRef.current) return;
    setError(null);
    if (!teamId) {
      setError('TEAM_NOT_FOUND');
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      const wasSubmitted = data.report.status === 'Submitted';
      const result = await apiRequest(`/admin/reports/${reportId}/assign`, {
        method: 'PATCH',
        body: { team_id: Number(teamId) },
      });
      onAssigned(result.report, wasSubmitted);
    } catch (err) {
      setError(err.code);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const report = data?.report;
  const teams = data?.teams || [];
  const suggestedTeam = teams.find((team) => team.coversArea);
  const chosenTeam = teams.find((team) => String(team.id) === teamId);
  const unchanged = report && String(report.teamId || '') === teamId;
  const displayId = report ? formatReportId(report.id, report.dateSubmitted) : '';

  // Title with the report ID kept on one line ("Assign Report #2026-0043").
  const [titleBefore, titleAfter = ''] = t('assignDialog.title', { id: '{id}' }).split('{id}');
  const title = report ? (
    <>
      {titleBefore}
      <span className="assign-dialog__id">{displayId}</span>
      {titleAfter}
    </>
  ) : (
    t('assign.title')
  );

  return (
    <Modal open={Boolean(reportId)} title={title} onClose={onClose}>
      {!report && !loadError && <p className="text-muted" role="status">{t('common.loading')}</p>}
      {loadError && <LoadError code={loadError} onRetry={() => setAttempt((count) => count + 1)} />}

      {report && (
        <form className="assign-dialog" onSubmit={handleConfirm} noValidate>
          {/* ----- Report details ----- */}
          <div className="assign-dialog__tags">
            <IssueTypeIcon type={report.issueType} />
            <PriorityBadge priority={report.priority} />
            <ReportStatus status={report.status} isOverdue={report.isOverdue} />
          </div>
          <dl className="assign-dialog__details">
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
              <dd className="assign-dialog__text">{report.description}</dd>
            </div>
            <div>
              <dt>{t('reportDetails.dateSubmitted')}</dt>
              <dd>{formatDateTime(report.dateSubmitted, language)}</dd>
            </div>
            {report.teamName && (
              <div>
                <dt>{t('adminReports.assignedTeam')}</dt>
                <dd>{report.teamName}</dd>
              </div>
            )}
          </dl>

          {report.status === 'Resolved' ? (
            <Alert type="success">{t('assign.resolved')}</Alert>
          ) : (
            <>
              {/* ----- Suggested team ----- */}
              <section className="assign-dialog__suggested" aria-labelledby="suggested-team-title">
                <h3 id="suggested-team-title" className="assign-dialog__label">
                  {t('assignDialog.suggestedTeam')}
                </h3>
                {suggestedTeam ? (
                  <div className="assign-dialog__suggested-team">
                    <span className="assign-dialog__team-name">{suggestedTeam.teamName}</span>
                    <span className="suggested-tag">{t('assign.suggested')}</span>
                    <span className="assign-dialog__covers">{t('assignDialog.covers', { areas: suggestedTeam.assignedArea })}</span>
                  </div>
                ) : (
                  <p className="text-muted">{t('assignDialog.noSuggested', { area: report.area })}</p>
                )}
              </section>

              {error && <Alert type="error">{t(`errors.${error}`)}</Alert>}
              <p className="text-muted">{t(report.status === 'Submitted' ? 'assign.hintNew' : 'assign.hintMove')}</p>

              <Select
                label={t('assignDialog.allTeams')}
                name="teamId"
                value={teamId}
                onChange={(event) => {
                  setTeamId(event.target.value);
                  setError(null);
                }}
                // Team names only: the suggested team is shown in the box above
                // (a longer option text gets cut off on phones).
                options={[
                  { value: '', label: t('assign.chooseTeam') },
                  ...teams.map((team) => ({ value: String(team.id), label: team.teamName })),
                ]}
              />
              {chosenTeam && <p className="text-muted assign-dialog__covers">{t('assign.covers', { areas: chosenTeam.assignedArea })}</p>}
            </>
          )}

          <Link to={`/admin/reports/${report.id}`} className="assign-dialog__details-link">
            {t('assignDialog.openDetails')}
          </Link>

          <div className="modal__actions">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('assignDialog.cancel')}
            </Button>
            {report.status !== 'Resolved' && (
              <Button type="submit" icon="users" disabled={saving || unchanged}>
                {saving ? t('profile.saving') : t('assignDialog.confirm')}
              </Button>
            )}
          </div>
        </form>
      )}
    </Modal>
  );
}
