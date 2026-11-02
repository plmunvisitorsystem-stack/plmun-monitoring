/**
 * Report Details for residents (/reports/:id).
 * The API only returns the resident's OWN report:
 *   another resident's report -> 403 -> "You cannot view this report"
 *   unknown id                -> 404 -> "Report not found"
 * "Give Feedback" shows only when the report is Resolved and has no feedback yet.
 */
import { Link, useLocation, useParams } from 'react-router-dom';
import ResidentLayout from '../../layouts/ResidentLayout';
import BackLink from '../../components/BackLink';
import Card from '../../components/Card';
import Icon from '../../components/Icon';
import IssueTypeIcon from '../../components/IssueTypeIcon';
import ReportStatus from '../../components/ReportStatus';
import StatusTimeline from '../../components/StatusTimeline';
import RatingStars from '../../components/RatingStars';
import PhotoGallery from '../../components/PhotoGallery';
import Alert from '../../components/Alert';
import EmptyState from '../../components/EmptyState';
import LoadError from '../../components/LoadError';
import { useLanguage } from '../../i18n/useLanguage';
import { useApiData } from '../../hooks/useApiData';
import LinkedReports from '../../components/LinkedReports';
import { formatDateTime, formatReportId } from '../../utils/format';
import '../../components/Button.css';
import './Resident.css';
import './Feedback.css';

export default function ReportDetailsPage() {
  const { t, language } = useLanguage();
  const { id } = useParams();
  const location = useLocation();
  const { data, loading, errorCode, reload } = useApiData(`/reports/${encodeURIComponent(id)}`);

  // Go back to the list the card was opened from (Home or My Reports).
  const backTo = location.state?.from || '/home';
  const report = data?.report;
  const canGiveFeedback = report?.status === 'Resolved' && !report.hasFeedback;
  // Set by the Feedback page right after feedback is sent.
  const feedbackJustSent = location.state?.notice === 'FEEDBACK_SENT';

  // ----- Error pages -----
  if (!loading && (errorCode === 'FORBIDDEN' || errorCode === 'NOT_FOUND')) {
    const forbidden = errorCode === 'FORBIDDEN';
    return (
      <ResidentLayout activeKey="home">
        <BackLink to="/home" />
        <EmptyState
          icon="warning"
          title={t(forbidden ? 'reportDetails.forbiddenTitle' : 'reportDetails.notFoundTitle')}
          message={t(forbidden ? 'reportDetails.forbiddenMessage' : 'errors.NOT_FOUND')}
          action={
            <Link to="/home" className="btn btn--primary">
              {t('submitReport.backToHome')}
            </Link>
          }
        />
      </ResidentLayout>
    );
  }

  return (
    <ResidentLayout activeKey="home" wide>
      <BackLink to={backTo} />

      {loading && <p className="text-muted" role="status">{t('common.loading')}</p>}
      {!loading && errorCode && <LoadError code={errorCode} onRetry={reload} />}

      {!loading && report && (
        <div className="details">
          {feedbackJustSent && <Alert type="success" title={t('feedback.sentTitle')}>{t('feedback.sent')}</Alert>}
          <div>
            <p className="text-muted">{t('reportDetails.title')}</p>
            <h1 className="page-title">{formatReportId(report.id, report.dateSubmitted)}</h1>
          </div>

          <div className="details__columns">
            <div className="details__column">
              <Card>
                <div className="details__top">
                  <IssueTypeIcon type={report.issueType} />
                  <ReportStatus status={report.status} isOverdue={report.isOverdue} />
                </div>
                <dl className="details__list">
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
                </dl>
                <LinkedReports reports={report.linkedReports} basePath="/reports" />
              </Card>

              <Card title={t('photos.title')}>
                <PhotoGallery photos={report.photos || []} />
              </Card>
            </div>

            <div className="details__column">
              <Card title={t('reportDetails.statusTitle')}>
                <StatusTimeline status={report.status} />
              </Card>

              {report.resolutionNotes && (
                <Card title={t('reportDetails.resolutionNotes')}>
                  <p className="details__text details__notes">{report.resolutionNotes}</p>
                </Card>
              )}

              {report.feedback && (
                <Card title={t('feedback.yourFeedback')}>
                  <div className="your-feedback__rating">
                    <RatingStars rating={report.feedback.rating} size={28} />
                    <span className="your-feedback__label">
                      {t('feedback.yourRating', {
                        label: t(`feedback.ratings.${report.feedback.rating}`),
                        rating: report.feedback.rating,
                      })}
                    </span>
                  </div>
                  {report.feedback.comments && <p className="your-feedback__comments">{report.feedback.comments}</p>}
                </Card>
              )}

              {canGiveFeedback && (
                <Link
                  to={`/reports/${report.id}/feedback`}
                  state={{ from: location.state?.from }}
                  className="btn btn--primary btn--full"
                >
                  <Icon name="star" />
                  <span>{t('reportDetails.giveFeedback')}</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </ResidentLayout>
  );
}
