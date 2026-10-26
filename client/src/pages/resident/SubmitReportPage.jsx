/**
 * Submit Report page (/report).
 * 1. The resident picks an issue type and area, types a street or landmark
 *    and a description, and may add up to MAX_PHOTOS photos (camera or gallery).
 * 2. "Submit Report" stays disabled until everything is valid.
 * 3. After saving, a success screen shows the reference number (#YYYY-####).
 * Photos are checked here first (type, size, count) for quick feedback;
 * the server checks them again, including the real file type.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import ResidentLayout from '../../layouts/ResidentLayout';
import Input from '../../components/Input';
import Select from '../../components/Select';
import { useApiData } from '../../hooks/useApiData';
import Button from '../../components/Button';
import Alert from '../../components/Alert';
import Icon from '../../components/Icon';
import { apiRequest } from '../../api/client';
import { useLanguage } from '../../i18n/useLanguage';
import { ISSUE_TYPES, ISSUE_TYPE_ICONS, ISSUE_TYPE_KEYS } from '../../utils/constants';
import { DESCRIPTION_MAX, LOCATION_MAX, validateReport } from '../../utils/validation';
import { formatDate, formatReportId } from '../../utils/format';
import './SubmitReport.css';

const EMPTY_FORM = { issueType: '', area: '', location: '', description: '' };

export default function SubmitReportPage() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState(EMPTY_FORM);
  const [touched, setTouched] = useState({}); // fields the user has left at least once
  const [serverErrors, setServerErrors] = useState({});
  const [errorCode, setErrorCode] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdReport, setCreatedReport] = useState(null);

  // Similar-report notice: once an issue type AND an area are chosen, ask the
  // server whether an unresolved report like this was sent in the last few days.
  const [similarDate, setSimilarDate] = useState(null);
  useEffect(() => {
    setSimilarDate(null);
    if (!form.issueType || !form.area) return undefined;
    let active = true; // ignore the answer if the choice changed meanwhile
    const query = new URLSearchParams({ issue_type: form.issueType, area: form.area });
    apiRequest(`/reports/similar?${query}`)
      .then((result) => {
        if (active) setSimilarDate(result.similar ? result.similar.dateSubmitted : null);
      })
      .catch(() => {}); // only a notice: the form still works without it
    return () => {
      active = false;
    };
  }, [form.issueType, form.area]);

  // Areas (puroks) come from the server (server/config/areas.js).
  const { data: areaData } = useApiData('/areas');
  const areas = areaData?.areas || [];

  // Photo limits come from server/config/rules.js (via /api/config).
  const { data: config } = useApiData('/config');
  const limits = { max: config?.maxPhotos ?? 5, maxMb: config?.maxPhotoMb ?? 5 };
  const limitValues = { max: limits.max, maxMb: limits.maxMb };

  // Chosen photos: [{ key, file, url }] (url = temporary preview address)
  const [photos, setPhotos] = useState([]);
  const [photoError, setPhotoError] = useState(null);
  const photosRef = useRef([]);
  photosRef.current = photos;
  // Free the preview addresses when leaving the page.
  useEffect(() => () => photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url)), []);

  // A ref changes immediately (state updates wait for the next render), so a
  // fast double-click cannot send the report twice.
  const sendingRef = useRef(false);
  const successHeadingRef = useRef(null);

  // Start with a clean form whenever /report is opened (e.g. tapping "Report"
  // in the bottom navigation while the success screen is showing).
  useEffect(() => {
    setForm(EMPTY_FORM);
    setTouched({});
    setServerErrors({});
    setErrorCode(null);
    setSubmitting(false);
    setCreatedReport(null);
    setPhotoError(null);
    setPhotos((current) => {
      current.forEach((photo) => URL.revokeObjectURL(photo.url));
      return [];
    });
    sendingRef.current = false;
  }, [location.key]);

  // Adds photos from the camera or gallery. Rejects (with a message) photos
  // that are not JPG/PNG, too large, or more than the limit.
  function addPhotos(event) {
    const chosen = [...event.target.files];
    event.target.value = ''; // so the same photo can be chosen again later
    setPhotoError(null);
    const accepted = [];
    let problem = null;
    for (const file of chosen) {
      if (photos.length + accepted.length >= limits.max) { problem = 'TOO_MANY_PHOTOS'; break; }
      if (!['image/jpeg', 'image/png'].includes(file.type)) { problem = 'INVALID_PHOTO_TYPE'; continue; }
      if (file.size > limits.maxMb * 1024 * 1024) { problem = 'PHOTO_TOO_LARGE'; continue; }
      accepted.push({ key: `${Date.now()}-${Math.random()}`, file, url: URL.createObjectURL(file) });
    }
    if (accepted.length) setPhotos((current) => [...current, ...accepted]);
    if (problem) setPhotoError(problem);
  }

  function removePhoto(key) {
    setPhotos((current) => {
      const removed = current.find((photo) => photo.key === key);
      if (removed) URL.revokeObjectURL(removed.url);
      return current.filter((photo) => photo.key !== key);
    });
    setPhotoError(null);
  }

  // Move focus to the success message so screen readers announce it.
  useEffect(() => {
    if (createdReport) successHeadingRef.current?.focus();
  }, [createdReport]);

  const errors = validateReport(form);
  const isValid = Object.keys(errors).length === 0;

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setServerErrors((current) => ({ ...current, [name]: undefined }));
  }

  function handleBlur(event) {
    const { name } = event.target;
    setTouched((current) => ({ ...current, [name]: true }));
  }

  // Server errors show right away; our own checks show after the user leaves the field.
  function fieldError(name) {
    const code = serverErrors[name] || (touched[name] ? errors[name] : null);
    return code ? t(`errors.${code}`) : undefined;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!isValid || sendingRef.current) return;

    sendingRef.current = true;
    setSubmitting(true);
    setErrorCode(null);

    try {
      // multipart/form-data: the text fields + every photo under "photos"
      const body = new FormData();
      Object.entries(form).forEach(([name, value]) => body.append(name, value));
      photos.forEach((photo) => body.append('photos', photo.file));
      const data = await apiRequest('/reports', { method: 'POST', body });
      setCreatedReport(data.report);
      window.scrollTo(0, 0);
    } catch (error) {
      setServerErrors(error.fields || {});
      setErrorCode(error.code);
      if (error.fields?.photos) setPhotoError(error.fields.photos);
      sendingRef.current = false;
      setSubmitting(false);
    }
  }

  // ----- Success screen -----
  if (createdReport) {
    return (
      <ResidentLayout>
        <div className="submit-success">
          <span className="submit-success__icon">
            <Icon name="checkCircle" size={80} />
          </span>
          <h1 className="page-title" tabIndex={-1} ref={successHeadingRef}>
            {t('messages.reportSubmitted')}
          </h1>
          <p>{t('submitReport.successText')}</p>
          <p className="submit-success__id">{formatReportId(createdReport.id, createdReport.dateSubmitted)}</p>
          <Button
            fullWidth
            onClick={() => navigate(`/reports/${createdReport.id}`, { state: { from: '/home' } })}
          >
            {t('actions.viewMyReport')}
          </Button>
          <Link to="/home" className="submit-success__home">
            {t('submitReport.backToHome')}
          </Link>
        </div>
      </ResidentLayout>
    );
  }

  // ----- Form -----
  const issueTypeError = serverErrors.issueType ? t(`errors.${serverErrors.issueType}`) : null;

  return (
    <ResidentLayout>
      <h1 className="page-title">{t('submitReport.title')}</h1>

      <form className="submit-form" onSubmit={handleSubmit} noValidate>
        {errorCode && <Alert type="error">{t(`errors.${errorCode}`, limitValues)}</Alert>}

        {/* Issue type: 2x2 grid of large buttons (radio buttons underneath) */}
        <fieldset className="issue-picker">
          <legend className="field__label">{t('submitReport.issueType')}</legend>
          <div className="issue-picker__grid">
            {ISSUE_TYPES.map((type) => {
              const selected = form.issueType === type;
              return (
                <label key={type} className={`issue-picker__option ${selected ? 'is-selected' : ''}`}>
                  <input
                    type="radio"
                    name="issueType"
                    value={type}
                    checked={selected}
                    onChange={handleChange}
                    className="visually-hidden"
                  />
                  <Icon name={ISSUE_TYPE_ICONS[type]} size={36} />
                  <span>{t(`issueType.${ISSUE_TYPE_KEYS[type]}`)}</span>
                </label>
              );
            })}
          </div>
          {issueTypeError && <p className="field__error">{issueTypeError}</p>}
        </fieldset>

        <div>
          <Select
            label={t('fields.area')}
            name="area"
            value={form.area}
            onChange={(event) => {
              handleChange(event);
              setTouched((current) => ({ ...current, area: true }));
            }}
            onBlur={handleBlur}
            options={[{ value: '', label: t('submitReport.chooseArea') }, ...areas.map((area) => ({ value: area, label: area }))]}
          />
          {fieldError('area') && <p className="field__error">{fieldError('area')}</p>}
        </div>

        {similarDate && (
          <Alert type="info">{t('submitReport.similarNotice', { date: formatDate(similarDate, language) })}</Alert>
        )}

        <Input
          label={t('fields.streetLandmark')}
          hint={t('fields.streetHint')}
          name="location"
          maxLength={LOCATION_MAX}
          value={form.location}
          onChange={handleChange}
          onBlur={handleBlur}
          error={fieldError('location')}
        />

        <div>
          <Input
            label={t('fields.description')}
            hint={t('submitReport.descriptionHint')}
            name="description"
            multiline
            rows={5}
            maxLength={DESCRIPTION_MAX}
            placeholder={t('fields.descriptionPlaceholder')}
            value={form.description}
            onChange={handleChange}
            onBlur={handleBlur}
            error={fieldError('description')}
          />
          <p className="char-counter">
            {t('submitReport.characterCount', { count: form.description.length, max: DESCRIPTION_MAX })}
          </p>
        </div>

        {/* ----- Photos (optional): camera or gallery, up to limits.max ----- */}
        <fieldset className="photo-picker">
          <legend className="field__label">{t('photos.sectionTitle', limitValues)}</legend>
          <div className="photo-picker__buttons">
            {/* A <label> wrapping a hidden file input opens the camera / gallery when tapped. */}
            <label className={`btn btn--outline photo-picker__button ${photos.length >= limits.max ? 'is-disabled' : ''}`}>
              <Icon name="camera" size={28} />
              <span>{t('photos.takePhoto')}</span>
              <input
                type="file"
                accept="image/jpeg,image/png"
                capture="environment"
                className="visually-hidden"
                onChange={addPhotos}
                disabled={photos.length >= limits.max}
              />
            </label>
            <label className={`btn btn--outline photo-picker__button ${photos.length >= limits.max ? 'is-disabled' : ''}`}>
              <Icon name="image" size={28} />
              <span>{t('photos.chooseGallery')}</span>
              <input
                type="file"
                accept="image/jpeg,image/png"
                multiple
                className="visually-hidden"
                onChange={addPhotos}
                disabled={photos.length >= limits.max}
              />
            </label>
          </div>

          <p className="photo-picker__count" aria-live="polite">
            {t('photos.count', { count: photos.length, max: limits.max })}
          </p>
          {photoError && (
            <p className="field__error" role="alert">
              <Icon name="alertCircle" size={18} />
              <span>{t(`errors.${photoError}`, limitValues)}</span>
            </p>
          )}

          {photos.length > 0 && (
            <ul className="photo-picker__thumbs">
              {photos.map((photo, index) => (
                <li key={photo.key} className="photo-picker__thumb">
                  <img src={photo.url} alt={t('photos.alt', { n: index + 1 })} />
                  <button
                    type="button"
                    className="photo-picker__remove"
                    onClick={() => removePhoto(photo.key)}
                    aria-label={t('photos.removeLabel', { n: index + 1 })}
                  >
                    <Icon name="close" size={18} />
                    <span>{t('photos.remove')}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        <div>
          <Button type="submit" fullWidth disabled={!isValid || submitting}>
            {submitting ? t('submitReport.submitting') : t('actions.submitReport')}
          </Button>
          {!isValid && <p className="submit-form__help">{t('submitReport.completeForm')}</p>}
        </div>
      </form>
    </ResidentLayout>
  );
}
