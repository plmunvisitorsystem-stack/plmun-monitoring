/**
 * Feedback page (/reports/:id/feedback).
 * The resident rates how their Resolved report was handled (1-5 stars)
 * and may add a comment. Feedback can be sent only once per report.
 * After sending, it returns to Report Details, which shows the rating.
 */
import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import ResidentLayout from '../../layouts/ResidentLayout';
import BackLink from '../../components/BackLink';
import Card from '../../components/Card';
import Icon from '../../components/Icon';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Alert from '../../components/Alert';
import IssueTypeIcon from '../../components/IssueTypeIcon';
import EmptyState from '../../components/EmptyState';
import LoadError from '../../components/LoadError';
import { apiRequest } from '../../api/client';
import { useLanguage } from '../../i18n/useLanguage';
import { useApiData } from '../../hooks/useApiData';
import { formatReportId } from '../../utils/format';
import '../../components/Button.css';
import './Feedback.css';

const RATINGS = [1, 2, 3, 4, 5];
const COMMENT_MAX = 500;

export default function FeedbackPage() {
  const { t } = useLanguage();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { data, loading, errorCode, reload } = useApiData(`/reports/${encodeURIComponent(id)}`);

  const [rating, setRating] = useState(0);
  const [comments, setComments] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false); // blocks a fast double-tap

  const report = data?.report;
  const detailsPath = `/reports/${id}`;

  // Feedback is not possible: show why (already sent, or not Resolved yet).
  const blockedCode =
    submitError === 'FEEDBACK_EXISTS' || submitError === 'REPORT_NOT_RESOLVED'
      ? submitError
      : report?.hasFeedback
        ? 'FEEDBACK_EXISTS'
        : report && report.status !== 'Resolved'
          ? 'REPORT_NOT_RESOLVED'
          : null;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!rating || sendingRef.current) return;

    sendingRef.current = true;
    setSending(true);
    setSubmitError(null);
    try {
      await apiRequest(`/reports/${report.id}/feedback`, { method: 'POST', body: { rating, comments } });
      // Back to Report Details, which shows a success message and the rating.
      navigate(detailsPath, { replace: true, state: { notice: 'FEEDBACK_SENT', from: location.state?.from } });
    } catch (error) {
      setFieldErrors(error.fields || {});
      setSubmitError(error.code);
      sendingRef.current = false;
      setSending(false);
    }
  }

  // ----- Report cannot be opened -----
  if (!loading && (errorCode === 'FORBIDDEN' || errorCode === 'NOT_FOUND')) {
    const forbidden = errorCode === 'FORBIDDEN';
    return (
      <ResidentLayout activeKey="home">
        <BackLink to="/home" />
        <EmptyState
          icon="warning"
          title={t(forbidden ? 'reportDetails.forbiddenTitle' : 'reportDetails.notFoundTitle')}
          message={t(forbidden ? 'reportDetails.forbiddenMessage' : 'errors.NOT_FOUND')}
        />
      </ResidentLayout>
    );
  }

  return (
    <ResidentLayout activeKey="home">
      <BackLink to={detailsPath} />

      {loading && <p className="text-muted" role="status">{t('common.loading')}</p>}
      {!loading && errorCode && <LoadError code={errorCode} onRetry={reload} />}

      {!loading && report && (
        <div className="feedback">
          <div>
            <p className="text-muted">{t('feedback.title')}</p>
            <h1 className="page-title">{formatReportId(report.id, report.dateSubmitted)}</h1>
          </div>

          <Card>
            <IssueTypeIcon type={report.issueType} />
            <p className="feedback__location">
              <Icon name="mapPin" size={18} />
              <span>{report.location}</span>
            </p>
          </Card>

          {blockedCode ? (
            <>
              <Alert type="error">{t(`errors.${blockedCode}`)}</Alert>
              <Link to={detailsPath} className="btn btn--outline btn--full">
                {t('feedback.backToReport')}
              </Link>
            </>
          ) : (
            <form className="feedback__form" onSubmit={handleSubmit} noValidate>
              {submitError && <Alert type="error">{t(`errors.${submitError}`)}</Alert>}

              {/* Five large stars. Each is a radio button, so arrow keys work too. */}
              <fieldset className="star-picker">
                <legend className="star-picker__question">{t('feedback.howSatisfied')}</legend>
                <div className="star-picker__row">
                  {RATINGS.map((value) => (
                    <label
                      key={value}
                      className={`star-picker__option ${value <= rating ? 'is-filled' : ''} ${value === rating ? 'is-selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="rating"
                        value={value}
                        checked={rating === value}
                        onChange={() => {
                          setRating(value);
                          setFieldErrors((current) => ({ ...current, rating: undefined }));
                        }}
                        className="visually-hidden"
                      />
                      <Icon name="star" size={40} filled={value <= rating} />
                      <span className="star-picker__label">{t(`feedback.ratings.${value}`)}</span>
                    </label>
                  ))}
                </div>
                <p className="star-picker__summary" aria-live="polite">
                  {rating
                    ? t('feedback.yourRating', { label: t(`feedback.ratings.${rating}`), rating })
                    : t('feedback.chooseRating')}
                </p>
                {fieldErrors.rating && <p className="field__error">{t(`errors.${fieldErrors.rating}`)}</p>}
              </fieldset>

              <div>
                <Input
                  label={t('feedback.commentsLabel')}
                  name="comments"
                  multiline
                  rows={4}
                  maxLength={COMMENT_MAX}
                  placeholder={t('feedback.commentsPlaceholder')}
                  value={comments}
                  onChange={(event) => setComments(event.target.value)}
                  error={fieldErrors.comments ? t(`errors.${fieldErrors.comments}`) : undefined}
                />
                <p className="char-counter">
                  {t('submitReport.characterCount', { count: comments.length, max: COMMENT_MAX })}
                </p>
              </div>

              <Button type="submit" icon="send" fullWidth disabled={!rating || sending}>
                {sending ? t('feedback.sending') : t('actions.sendFeedback')}
              </Button>
            </form>
          )}
        </div>
      )}
    </ResidentLayout>
  );
}
