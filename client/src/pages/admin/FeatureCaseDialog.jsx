/**
 * "Feature on Landing Page" form (LGU), used to add a case from the Report
 * Details page and to edit one on the Featured Cases page.
 *   caption: required, max 200 characters (English, saved as typed)
 *   photo:   one "after" photo, JPG/PNG, max MAX_PHOTO_MB (required when adding)
 *   preview: the real public slide (FeaturedSlide), updated while typing
 *
 * Props:
 *   open, onClose
 *   slide:    { issueType, area, dateResolved } of the report
 *   reportId: set when adding
 *   featured: the case when editing (its current photo is shown until replaced)
 *   onSaved(featured)
 */
import { useEffect, useRef, useState } from 'react';
import Modal from '../../components/Modal';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Alert from '../../components/Alert';
import Icon from '../../components/Icon';
import FeaturedSlide from '../../components/FeaturedSlide';
import { apiRequest, fetchImageUrl } from '../../api/client';
import { useApiData } from '../../hooks/useApiData';
import { useLanguage } from '../../i18n/useLanguage';
import './FeaturedCases.css';

const CAPTION_MAX = 200;

export default function FeatureCaseDialog({ open, onClose, slide, reportId, featured, onSaved }) {
  const { t } = useLanguage();
  const { data: config } = useApiData('/config');
  const maxMb = config?.maxPhotoMb ?? 5;

  const [caption, setCaption] = useState('');
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [errors, setErrors] = useState({});
  const [errorCode, setErrorCode] = useState(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  // Reset the form each time it opens.
  useEffect(() => {
    if (!open) return;
    setCaption(featured?.caption || '');
    setFile(null);
    setErrors({});
    setErrorCode(null);
  }, [open, featured]);

  // Preview photo: the chosen file, or (when editing) the current photo.
  useEffect(() => {
    if (!open) return undefined;
    let url = null;
    let cancelled = false;
    if (file) {
      url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else if (featured?.photoUrl) {
      setPreviewUrl(null);
      fetchImageUrl(featured.photoUrl)
        .then((loaded) => {
          if (cancelled) URL.revokeObjectURL(loaded);
          else {
            url = loaded;
            setPreviewUrl(loaded);
          }
        })
        .catch(() => {});
    } else {
      setPreviewUrl(null);
    }
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [open, file, featured]);

  function choosePhoto(event) {
    const chosen = event.target.files?.[0];
    event.target.value = ''; // so the same photo can be chosen again
    if (!chosen) return;
    let problem = null;
    if (!['image/jpeg', 'image/png'].includes(chosen.type)) problem = 'INVALID_PHOTO_TYPE';
    else if (chosen.size > maxMb * 1024 * 1024) problem = 'PHOTO_TOO_LARGE';
    setErrors((current) => ({ ...current, photo: problem || undefined }));
    if (!problem) setFile(chosen);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (savingRef.current) return;
    setErrorCode(null);

    const text = caption.trim();
    const found = {};
    if (!text) found.caption = 'CAPTION_REQUIRED';
    else if (text.length > CAPTION_MAX) found.caption = 'CAPTION_TOO_LONG';
    if (!featured && !file) found.photo = 'PHOTO_REQUIRED';
    if (errors.photo && !found.photo) found.photo = errors.photo;
    setErrors(found);
    if (Object.keys(found).length) return;

    const body = new FormData();
    body.append('caption', text);
    if (!featured) body.append('reportId', String(reportId));
    if (file) body.append('photo', file);

    savingRef.current = true;
    setSaving(true);
    try {
      const result = featured
        ? await apiRequest(`/admin/featured-cases/${featured.id}`, { method: 'PUT', body })
        : await apiRequest('/admin/featured-cases', { method: 'POST', body });
      onSaved(result.featured);
    } catch (error) {
      if (error.fields && Object.keys(error.fields).length) setErrors(error.fields);
      else setErrorCode(error.code);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const errorText = (name) => (errors[name] ? t(`errors.${errors[name]}`, { maxMb, max: CAPTION_MAX }) : undefined);

  return (
    <Modal open={open} title={t(featured ? 'featured.editTitle' : 'featured.addTitle')} onClose={onClose}>
      <form className="feature-form" onSubmit={handleSubmit} noValidate>
        {errorCode && <Alert type="error">{t(`errors.${errorCode}`)}</Alert>}

        <div>
          <Input
            label={t('featured.caption')}
            hint={t('featured.captionHint')}
            multiline
            rows={3}
            name="caption"
            value={caption}
            maxLength={CAPTION_MAX + 50}
            onChange={(event) => {
              setCaption(event.target.value);
              setErrors((current) => ({ ...current, caption: undefined }));
            }}
            error={errorText('caption')}
          />
          <p className={`feature-form__count ${caption.trim().length > CAPTION_MAX ? 'is-over' : ''}`} aria-live="polite">
            {t('submitReport.characterCount', { count: caption.trim().length, max: CAPTION_MAX })}
          </p>
        </div>

        <fieldset className="feature-form__photo">
          <legend className="field__label">{t('featured.afterPhoto')}</legend>
          <p className="field__hint">{t(featured ? 'featured.afterPhotoHintEdit' : 'featured.afterPhotoHint', { max: maxMb })}</p>
          <label className="btn btn--outline feature-form__choose">
            <Icon name="image" />
            <span>{t(file || featured ? 'featured.replacePhoto' : 'featured.choosePhoto')}</span>
            <input type="file" accept="image/jpeg,image/png" className="visually-hidden" onChange={choosePhoto} />
          </label>
          {file && <p className="text-muted feature-form__file">{file.name}</p>}
          {errors.photo && (
            <p className="field__error" role="alert">
              {errorText('photo')}
            </p>
          )}
        </fieldset>

        <section aria-label={t('featured.preview')}>
          <h3 className="feature-form__preview-title">{t('featured.preview')}</h3>
          <p className="field__hint">{t('featured.previewHint')}</p>
          <FeaturedSlide photoSrc={previewUrl} caption={caption.trim()} {...slide} />
        </section>

        <div className="modal__actions">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t('featured.cancel')}
          </Button>
          <Button type="submit" icon="star" disabled={saving}>
            {saving ? t('profile.saving') : t(featured ? 'featured.saveChanges' : 'featured.publish')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
